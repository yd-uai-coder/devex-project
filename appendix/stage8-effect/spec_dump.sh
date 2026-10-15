#!/bin/sh
# テスト仕様書の model を書き出す: spec_dump.sh <project_id> <version> <out.json>
cd ../../devex-api && docker compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -At -c \"select model from generated_documents where doc_type='test_spec' and project_id='$1' and version=$2\"" > "../appendix/stage8-effect/$3"
