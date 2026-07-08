FROM node:22-alpine

# ffmpeg cho ghi hình; tzdata để TZ=Asia/Ho_Chi_Minh đúng (đặt tên file theo ngày local)
RUN apk add --no-cache ffmpeg tzdata

WORKDIR /app

# Không có dependency ngoài (dùng fetch/child_process/fs built-in) — copy package cho metadata
COPY package*.json ./
COPY agent.js recorder.js go2rtc-sync.js playback.js ./

ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh

CMD ["node", "agent.js"]
