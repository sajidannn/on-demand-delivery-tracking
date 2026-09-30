CREATE DATABASE auth_db;
CREATE DATABASE order_db;
CREATE DATABASE location_db;

\c order_db
CREATE EXTENSION IF NOT EXISTS postgis;

\c location_db
CREATE EXTENSION IF NOT EXISTS postgis;
