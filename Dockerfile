FROM nginx:alpine

RUN sed -i 's/^\(.*\)http {/\1http {\n    map_hash_bucket_size 128;\n/' /etc/nginx/nginx.conf

COPY nginx/ /etc/nginx/conf.d/

COPY public /usr/share/nginx/html
