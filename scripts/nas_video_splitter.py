#!/usr/bin/env python3
"""
NAS Video Auto-Splitter v1.0
Doc cau hinh tu file nas_config.json (do Node.js Backend sinh ra)
"""

import os
import sys
import subprocess
import shutil
import datetime
import time
import logging
import argparse
import signal
import json
from pathlib import Path

# ============================================
# DOC CONFIG TU FILE JSON
# ============================================
SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR / "nas_config.json"

def load_config():
    """Doc cau hinh tu file JSON do Backend sinh."""
    if not CONFIG_FILE.exists():
        print(f"LOI: Khong tim thay file config: {CONFIG_FILE}")
        print("Vui long sinh config tu Admin Panel truoc khi chay script.")
        sys.exit(1)

    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        config = json.load(f)

    # Validate bắt buộc
    required = ['nas_root', 'rooms', 'segment_duration', 'source_dir']
    for key in required:
        if key not in config or not config[key]:
            print(f"LOI: Thieu cau hinh bat buoc: {key}")
            sys.exit(1)

    return config

CONFIG = load_config()

# ============================================
# LOGGING
# ============================================
log_file = CONFIG.get('log_file', '/tmp/nas_video_splitter.log')
log_dir = os.path.dirname(log_file)
if log_dir and not os.path.exists(log_dir):
    os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("nas_splitter")

# ============================================
# KIEM TRA PHU THUOC
# ============================================
def check_dependencies():
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            raise Exception("FFmpeg tra ve loi")
        logger.info(f"FFmpeg: {result.stdout.split(chr(10))[0]}")
    except FileNotFoundError:
        logger.error("KHONG TIM THAY FFmpeg! Cai dat: sudo apt install ffmpeg")
        sys.exit(1)

    if not os.path.exists(CONFIG["source_dir"]):
        logger.error(f"Thu muc nguon khong ton tai: {CONFIG['source_dir']}")
        sys.exit(1)

    if not os.path.exists(CONFIG["nas_root"]):
        logger.warning(f"Thu muc NAS khong ton tai: {CONFIG['nas_root']}")
        logger.warning("Dam bao NAS da duoc mount!")
    else:
        logger.info(f"NAS path: {CONFIG['nas_root']} (OK)")

# ============================================
# LAY THONG TIN VIDEO
# ============================================
def get_video_info(file_path):
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration,size",
        "-show_entries", "stream=codec_name,width,height",
        "-of", "json",
        str(file_path)
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        info = json.loads(result.stdout)
        duration = float(info.get("format", {}).get("duration", 0))
        size = int(info.get("format", {}).get("size", 0))
        video_stream = None
        for s in info.get("streams", []):
            if s.get("width"):
                video_stream = s
                break
        return {
            "duration": duration,
            "size": size,
            "width": video_stream.get("width", 0) if video_stream else 0,
            "height": video_stream.get("height", 0) if video_stream else 0,
            "codec": video_stream.get("codec_name", "unknown") if video_stream else "unknown"
        }
    except Exception as e:
        logger.error(f"Khong the doc thong tin video {file_path}: {e}")
        return None

# ============================================
# CAT VIDEO
# ============================================
def split_video(input_file, output_dir, room_name):
    info = get_video_info(input_file)
    if info is None:
        return 0

    duration = info["duration"]
    seg_dur = CONFIG["segment_duration"]
    out_fmt = CONFIG["output_format"]
    codec_str = CONFIG.get("codec", "copy")
    codec_parts = codec_str.split()

    if duration <= seg_dur:
        output_file = output_dir / f"{input_file.stem}_part001{out_fmt}"
        cmd = ["ffmpeg", "-y", "-i", str(input_file), "-c", "copy", "-avoid_negative_ts", "1", str(output_file)]
        subprocess.run(cmd, capture_output=True, text=True)
        logger.info(f"  -> Copy nguyen: {output_file.name}")
        return 1

    num_segments = int(duration / seg_dur) + (1 if duration % seg_dur > 0 else 0)
    logger.info(f"  -> Cat thanh {num_segments} phan ({seg_dur}s moi phan)")

    success_count = 0
    for i in range(num_segments):
        start_time = i * seg_dur
        output_file = output_dir / f"{input_file.stem}_part{str(i + 1).padStart(3, '0')}{out_fmt}"

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-i", str(input_file),
            "-t", str(seg_dur),
        ]
        # Thêm codec params
        for part in codec_parts:
            cmd.extend(["-c:v", part])
        cmd.extend(["-avoid_negative_ts", "1", "-map_metadata", "0", str(output_file)])

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode == 0 and output_file.exists():
                size_mb = output_file.stat().st_size / (1024 * 1024)
                logger.info(f"     [{i + 1}/{num_segments}] {output_file.name} ({size_mb:.1f} MB)")
                success_count += 1
            else:
                logger.error(f"     [{i + 1}/{num_segments}] Loi: {result.stderr[-200:]}")
        except subprocess.TimeoutExpired:
            logger.error(f"     [{i + 1}/{num_segments}] Timeout!")
        except Exception as e:
            logger.error(f"     [{i + 1}/{num_segments}] Loi: {e}")

    return success_count

# ============================================
# XU LY CHINH
# ============================================
def process_source_dir():
    source = Path(CONFIG["source_dir"])
    extensions = CONFIG.get("video_extensions", [".mp4", ".mkv", ".avi", ".mov", ".flv", ".wmv", ".ts"])
    video_files = [f for f in source.iterdir() if f.is_file() and f.suffix.lower() in extensions]

    if not video_files:
        logger.info("Khong tim thay video nao trong thu muc nguon.")
        return

    logger.info(f"Tim thay {len(video_files)} video trong {source}")
    today_str = datetime.datetime.now().strftime(CONFIG["date_format"])

    for room in CONFIG["rooms"]:
        room_dir = Path(CONFIG["nas_root"]) / room / today_str
        room_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"\n{'=' * 50}")
        logger.info(f"Phong: {room} | Ngay: {today_str}")
        logger.info(f"Thu muc: {room_dir}")
        logger.info(f"{'=' * 50}")

        for video_file in video_files:
            logger.info(f"\nXu ly: {video_file.name}")
            info = get_video_info(video_file)
            if info:
                logger.info(f"  Thong tin: {info['duration'] / 60:.1f} phut, {info['size'] / (1024 * 1024):.1f} MB, {info['width']}x{info['height']}, {info['codec']}")

            count = split_video(video_file, room_dir, room)
            logger.info(f"  Hoan thanh: {count} file da tao")

            if CONFIG.get("delete_source", False) and count > 0:
                try:
                    video_file.unlink()
                    logger.info(f"  Da xoa file goc: {video_file.name}")
                except Exception as e:
                    logger.error(f"  Khong the xoa file goc: {e}")

    logger.info(f"\n{'=' * 50}")
    logger.info("XU LY HOAN TAT!")
    logger.info(f"{'=' * 50}")

# ============================================
# CHE DO WATCH
# ============================================
class Watcher:
    def __init__(self):
        self.processed = set()
        self.running = True

    def scan(self):
        source = Path(CONFIG["source_dir"])
        if not source.exists():
            return
        extensions = CONFIG.get("video_extensions", [".mp4", ".mkv", ".avi", ".mov", ".flv", ".wmv", ".ts"])
        for f in source.iterdir():
            if f.is_file() and f.suffix.lower() in extensions:
                if self._is_file_ready(f):
                    file_key = f"{f.stat().st_size}_{f.stat().st_mtime}"
                    if file_key not in self.processed:
                        self.processed.add(file_key)
                        logger.info(f"Phat hien file moi: {f.name}")
                        self._process_single(f)

    def _is_file_ready(self, filepath):
        try:
            with open(filepath, 'rb'):
                pass
            size1 = filepath.stat().st_size
            time.sleep(1)
            size2 = filepath.stat().st_size
            return size1 == size2
        except (IOError, OSError):
            return False

    def _process_single(self, video_file):
        today_str = datetime.datetime.now().strftime(CONFIG["date_format"])
        for room in CONFIG["rooms"]:
            room_dir = Path(CONFIG["nas_root"]) / room / today_str
            room_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Xu ly: {video_file.name} -> {room}/{today_str}/")
            count = split_video(video_file, room_dir, room)
            if CONFIG.get("delete_source", False) and count > 0:
                try:
                    video_file.unlink()
                    logger.info(f"Da xoa file goc: {video_file.name}")
                except Exception as e:
                    logger.error(f"Khong the xoa: {e}")

    def run(self):
        interval = CONFIG.get("watch_interval", 30)
        logger.info(f"Bat dau giam sat: {CONFIG['source_dir']} (moi {interval}s)")
        logger.info("Nhan Ctrl+C de dung.")
        while self.running:
            self.scan()
            time.sleep(interval)

    def stop(self):
        self.running = False

watcher = None

def signal_handler(sig, frame):
    logger.info("\nDang thoat...")
    if watcher:
        watcher.stop()
    sys.exit(0)

# ============================================
# MAIN
# ============================================
def main():
    global watcher
    parser = argparse.ArgumentParser(description="NAS Video Auto-Splitter")
    parser.add_argument("--watch", action="store_true", help="Giam sat tu dong")
    args = parser.parse_args()

    logger.info("=" * 50)
    logger.info("  NAS Video Auto-Splitter v1.0")
    logger.info("=" * 50)
    logger.info(f"  NAS Root     : {CONFIG['nas_root']}")
    logger.info(f"  Phong        : {', '.join(CONFIG['rooms'])}")
    logger.info(f"  Do dai phan  : {CONFIG['segment_duration']}s")
    logger.info(f"  Nguon        : {CONFIG['source_dir']}")
    logger.info(f"  Xoa goc      : {CONFIG.get('delete_source', False)}")
    logger.info("=" * 50)

    check_dependencies()

    if args.watch:
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        watcher = Watcher()
        watcher.run()
    else:
        process_source_dir()

if __name__ == "__main__":
    main()