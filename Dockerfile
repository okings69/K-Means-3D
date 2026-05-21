FROM nginx:alpine

RUN apk add --no-cache curl

# Three.js is stored locally in the container so the app works without CDN access at runtime.
RUN curl -L https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js -o /usr/share/nginx/html/three.min.js

COPY index.html /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

EXPOSE 80
