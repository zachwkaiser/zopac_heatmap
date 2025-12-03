#!/bin/bash
# Get database credentials from fly secrets
DB_HOST=$(fly ssh console -a seng401-project-zopac -C "echo \$POSTGRES_HOST")
DB_NAME=$(fly ssh console -a seng401-project-zopac -C "echo \$POSTGRES_DATABASE")
DB_USER=$(fly ssh console -a seng401-project-zopac -C "echo \$POSTGRES_USER")
DB_PASS=$(fly ssh console -a seng401-project-zopac -C "echo \$POSTGRES_PASSWORD")

# Query the database for table information
fly ssh console -a seng401-project-zopac-postgres -C "psql -h localhost -d seng401_project_zopac -c '\dt'"
