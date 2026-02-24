# Stage 1
FROM node:24 as react-build
WORKDIR /app
COPY . ./
RUN npm install
RUN npm run build

# Stage 2 - the production environment
FROM dhi.io/nginx:1-alpine3.23


COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY privacy.html /usr/share/nginx/html

COPY --from=react-build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["-g", "daemon off;"]