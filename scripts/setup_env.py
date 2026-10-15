"""Generate local development credentials without overwriting an existing .env."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
output = root / '.env'
values = {
    'APP_PORT': '8088', 'MYSQL_DATABASE': 'gamehub', 'MYSQL_USER': 'gamehub',
    'MYSQL_PASSWORD': secrets.token_hex(24), 'MYSQL_ROOT_PASSWORD': secrets.token_hex(24),
    'RABBITMQ_USER': 'gamehub', 'RABBITMQ_PASSWORD': secrets.token_hex(24),
    'MINIO_ACCESS_KEY': 'gamehub', 'MINIO_SECRET_KEY': secrets.token_hex(24),
    'JWT_SECRET': secrets.token_hex(48), 'ADMIN_USERNAME': 'admin',
    'ADMIN_PASSWORD': secrets.token_hex(16),
}
try:
    with output.open('x', encoding='utf-8') as file:
        file.write(''.join(f'{key}={value}\n' for key, value in values.items()))
    output.chmod(0o600)
except FileExistsError:
    raise SystemExit('.env 已存在，保留现有配置。')
print('.env 已生成。管理员账号为 admin，密码见 .env 中的 ADMIN_PASSWORD。')
