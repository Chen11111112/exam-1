#!/usr/bin/env bash
# 建置考試用映像檔
#
#   scripts/build-exam-images.sh                    # 建置 amd64 + arm64，輸出 exam-kit/*.tar
#   scripts/build-exam-images.sh --push <registry>  # 建置多平台映像並推送，例如 ghcr.io/your-org
set -euo pipefail

cd "$(dirname "$0")/.."

TAG="${EXAM_TAG:-latest}"
PLATFORMS=(amd64 arm64)

if [[ "${1:-}" == "--push" ]]; then
  REGISTRY="${2:?請指定 registry，例如 ghcr.io/your-org}"
  PREFIX="$REGISTRY/shangzhi-exam"
  docker buildx build --platform linux/amd64,linux/arm64 -f docker/db/Dockerfile -t "$PREFIX-db:$TAG" --push .
  docker buildx build --platform linux/amd64,linux/arm64 -f Dockerfile -t "$PREFIX-api:$TAG" --push .
  echo "已推送：$PREFIX-db:$TAG、$PREFIX-api:$TAG"
  echo "考生執行：EXAM_IMAGE_PREFIX=$PREFIX docker compose up -d --wait"
  exit 0
fi

PREFIX="shangzhi-exam"
for arch in "${PLATFORMS[@]}"; do
  docker buildx build --platform "linux/$arch" -f docker/db/Dockerfile -t "$PREFIX-db:$TAG" --load .
  docker buildx build --platform "linux/$arch" -f Dockerfile -t "$PREFIX-api:$TAG" --load .
  docker save "$PREFIX-db:$TAG" "$PREFIX-api:$TAG" -o "exam-kit/$PREFIX-images-$arch.tar"
  echo "已輸出 exam-kit/$PREFIX-images-$arch.tar"
done
