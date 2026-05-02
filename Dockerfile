FROM nginx:alpine
COPY index.html game.js style.css /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
RUN chmod -R 755 /usr/share/nginx/html/assets/
EXPOSE 80
