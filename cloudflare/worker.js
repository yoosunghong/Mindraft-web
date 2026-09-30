// mindraft.yoosung.dev의 HTTP와 WebSocket 요청을 서울 Cloud Run으로 전달한다.
// Cloudflare Worker Route: mindraft.yoosung.dev/*
const origin = 'https://mindraft-772237580154.asia-northeast3.run.app';

export default {
  fetch(request) {
    const upstream = new URL(request.url);
    upstream.protocol = 'https:';
    upstream.host = new URL(origin).host;
    return fetch(new Request(upstream, request));
  }
};
