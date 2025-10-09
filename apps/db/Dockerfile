FROM postgres:16.2-alpine

ENV POSTGRES_USER=user
ENV POSTGRES_DB=postgres
ENV POSTGRES_PASSWORD=password

# Configure PostgreSQL settings
CMD ["postgres", \
     "-c", "wal_level=logical", \
     "-c", "max_wal_senders=10", \
     "-c", "max_replication_slots=5", \
     "-c", "hot_standby=on", \
     "-c", "hot_standby_feedback=on"]
