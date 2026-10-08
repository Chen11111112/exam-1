FROM mysql:8.4

ENV MYSQL_ROOT_PASSWORD=root \
    MYSQL_DATABASE=nextjs_db \
    TZ=Asia/Taipei

COPY sql/init.sql /docker-entrypoint-initdb.d/init.sql

CMD ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci"]
