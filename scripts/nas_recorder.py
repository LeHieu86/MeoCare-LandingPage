#!/usr/bin/env python3
"""NAS Video Recorder v2.4"""
import os, sys, subprocess, signal, json, time, logging, datetime
import fcntl
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR / "nas_config.json"
LOCK_FILE = SCRIPT_DIR / "nas_recorder.lock"
CHECK_FILE = SCRIPT_DIR / ".nas_check"

with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
    CONFIG = json.load(f)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S", handlers=[logging.StreamHandler(sys.stdout)])
logger = logging.getLogger("nas_recorder")

NAS_ROOT = CONFIG['nas_root']
running = True
threads = []
stop_requested_at = None
current_ffmpeg = {}

def acquire_lock():
    try:
        lock_fd = open(LOCK_FILE, 'w')
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        lock_fd.write(str(os.getpid()))
        lock_fd.flush()
        return lock_fd
    except IOError:
        logger.error("Recorder da chay!")
        sys.exit(1)

def release_lock(lock_fd):
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()
        if LOCK_FILE.exists(): LOCK_FILE.unlink()
    except: pass

def is_nas_alive():
    """Kiem tra NAS bang cach thu ghi 1 file nho vao thu muc NAS."""
    try:
        CHECK_FILE.write_text('alive')
        CHECK_FILE.unlink()
        return True
    except:
        return False

def wait_for_nas(max_wait=120):
    logger.warning("NAS khong ghi duoc! Doi remount...")
    elapsed = 0
    while elapsed < max_wait and running:
        subprocess.run(['mount', '-a'], capture_output=True, timeout=10)
        time.sleep(5)
        elapsed += 5
        if is_nas_alive():
            logger.info(f"NAS OK lai sau {elapsed}s")
            return True
    logger.error("NAS khong the ket noi lai!")
    return False

def signal_handler(sig, frame):
    global running, stop_requested_at
    stop_requested_at = datetime.datetime.now().strftime('%H:%M:%S')
    running = False
    logger.info("=" * 50)
    logger.info(f"  YEU CAU DUNG luc {stop_requested_at}")
    logger.info("=" * 50)
    for name, proc in list(current_ffmpeg.items()):
        if proc.poll() is None:
            proc.terminate()
            logger.info(f"  [{name}] -> FFmpeg SIGTERM")

def record_loop(room):
    name = room['name']
    rtsp = room.get('rtsp_url')
    if not rtsp:
        logger.warning(f"[{name}] Khong co RTSP URL")
        return

    seg_dur = CONFIG['segment_duration']
    out_fmt = CONFIG['output_format'].lstrip('.')
    date_fmt = CONFIG['date_format']

    logger.info(f"[{name}] Bat dau ghi tu: {rtsp}")

    while running:
        if not is_nas_alive():
            if not wait_for_nas():
                break

        now = datetime.datetime.now()
        date_str = now.strftime(date_fmt)
        time_str = now.strftime('%H%M%S')
        output_dir = Path(NAS_ROOT) / name / date_str

        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.error(f"[{name}] Khong tao thu muc: {e}")
            if not wait_for_nas():
                break
            continue

        output_file = output_dir / f"part_{time_str}.{out_fmt}"

        if stop_requested_at:
            logger.info(f"[{name}] Dang ghi file cuoi: {output_file.name}")
        else:
            logger.info(f"[{name}] Ghi: {output_file.name}")

        cmd = ['ffmpeg', '-y', '-rtsp_transport', 'tcp', '-i', rtsp, '-t', str(seg_dur), '-c', 'copy', '-avoid_negative_ts', 'make_zero', str(output_file)]

        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            current_ffmpeg[name] = proc

            while proc.poll() is None and running:
                time.sleep(1)

            if name in current_ffmpeg:
                del current_ffmpeg[name]

            code = proc.poll()
            if code is not None and code == 0 and output_file.exists():
                size_mb = output_file.stat().st_size / (1024 * 1024)
                logger.info(f"[{name}] Xong: {output_file.name} ({size_mb:.1f} MB)")
            elif stop_requested_at:
                if output_file.exists():
                    size_mb = output_file.stat().st_size / (1024 * 1024)
                    if size_mb > 0.5:
                        logger.info(f"[{name}] File cuoi da luu: {output_file.name} ({size_mb:.1f} MB)")
                    else:
                        try: output_file.unlink()
                        except: pass
            else:
                logger.error(f"[{name}] FFmpeg loi (code {code})")
                if output_file.exists():
                    try: output_file.unlink()
                    except: pass
                time.sleep(15)

        except Exception as e:
            logger.error(f"[{name}] Loi: {e}")
            if name in current_ffmpeg:
                del current_ffmpeg[name]
            time.sleep(15)

        if not running:
            break
        time.sleep(2)

    logger.info(f"[{name}] Dung ghi.")

if __name__ == "__main__":
    lock_fd = acquire_lock()
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info("=" * 50)
    logger.info("  NAS Video Recorder v2.4")
    logger.info("=" * 50)
    logger.info(f"  NAS Root  : {NAS_ROOT}")
    for r in CONFIG['rooms']:
        rtsp = r.get('rtsp_url', 'CHUA CAU HINH')
        logger.info(f"  {r['name']:15s} -> {rtsp}")
    logger.info(f"  Segment   : {CONFIG['segment_duration']}s")
    logger.info("=" * 50)

    if not is_nas_alive():
        logger.error(f"NAS khong ghi duoc: {NAS_ROOT}")
        logger.error("Kiem tra: sudo systemctl start mnt-nas.mount")
        release_lock(lock_fd)
        sys.exit(1)

    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
    except FileNotFoundError:
        logger.error("FFmpeg khong tim thay!")
        release_lock(lock_fd)
        sys.exit(1)

    missing = [r['name'] for r in CONFIG['rooms'] if not r.get('rtsp_url')]
    if missing:
        logger.error(f"Phong chua co RTSP: {', '.join(missing)}")
        release_lock(lock_fd)
        sys.exit(1)

    import threading
    for room in CONFIG['rooms']:
        t = threading.Thread(target=record_loop, args=(room,), daemon=True)
        t.start()
        threads.append(t)
        logger.info(f"Thread bat dau cho: {room['name']}")

    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        signal_handler(None, None)

    for name, proc in list(current_ffmpeg.items()):
        if proc.poll() is None:
            try: proc.wait(timeout=30)
            except: proc.kill()

    for t in threads:
        t.join(timeout=10)

    if stop_requested_at:
        logger.info(f"Da dung hoan tat luc {stop_requested_at}")
    else:
        logger.info("Recorder da dung.")

    release_lock(lock_fd)
