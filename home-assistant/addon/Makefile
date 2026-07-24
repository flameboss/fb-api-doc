# Convenience targets for building the add-on locally.
#
# relay.py and requirements.txt are the single source in ../prototype; `sync`
# copies them into this build context. They are gitignored here so this doc
# repo keeps one copy. When this addon/ moves to its own add-on repository,
# commit relay.py + requirements.txt there instead (drop the sync + gitignore).

PROTO := ../prototype
# Pick the base image for your host arch to test a local build.
BUILD_FROM ?= ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20

.PHONY: sync build clean

sync:
	cp $(PROTO)/relay.py relay.py
	cp $(PROTO)/requirements.txt requirements.txt

build: sync
	docker build --build-arg BUILD_FROM=$(BUILD_FROM) -t local/addon-flameboss .

clean:
	rm -f relay.py requirements.txt
