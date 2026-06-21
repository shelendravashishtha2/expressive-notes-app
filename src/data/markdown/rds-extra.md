
## RDS production network shape

```mermaid
flowchart TD
  A[Application Lambda/ECS] -->|SG allows 5432| B[RDS PostgreSQL primary]
  B --> C[Automated backups]
  B --> D[Read replica]
  B --> E[Multi-AZ standby]
  A --> F[Secrets Manager]
  A --> G[RDS Proxy optional]
```

## RDS types and choices

| Choice | Meaning | When useful |
|---|---|---|
| Single-AZ | one DB instance in one AZ | dev/test or non-critical systems |
| Multi-AZ DB instance | primary + standby failover | production HA, standby not read target |
| Multi-AZ DB cluster | writer + readable standbys | production HA with more read capacity |
| Read replica | async read scaling | reporting/read-heavy workloads |
| RDS Proxy | managed connection pooling | Lambda/serverless spikes to relational DB |
| Aurora | AWS cloud-native relational engine | high availability, scaling, faster failover patterns |

## Python SQLAlchemy setup

```python
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql+psycopg2://app_user:password@db.example.ap-south-1.rds.amazonaws.com:5432/appdb"

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_user(user_id: int):
    with SessionLocal() as session:
        return session.execute(
            text("SELECT id, email, name FROM users WHERE id = :id"),
            {"id": user_id},
        ).mappings().first()
```

Production details:

- keep DB in private subnets;
- allow inbound DB port only from application security group;
- use Secrets Manager for credentials;
- enable automated backups and deletion protection;
- monitor CPU, connections, storage, freeable memory, replication lag, and slow queries;
- use migrations for schema changes;
- use RDS Proxy for Lambda-heavy workloads.
