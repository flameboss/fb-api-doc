
HTML_DIR = ../myflameboss/public/doc/api

ifeq ($(shell uname), Linux)
OS_DEPS = /usr/bin/asyncapi
else
OS_DEPS = /opt/homebrew/bin/asyncapi
endif

all:	$(OS_DEPS) html/index.html

html/index.html:	fb-api.yml
	asyncapi generate fromTemplate fb-api.yml @asyncapi/html-template@3.5.6 -o html --force-write -p sidebarOrganization=byTagsNoRoot

clean:
	rm -rf html

install:
	mkdir -p $(HTML_DIR)
	cp -r html/* $(HTML_DIR)/

start stop restart:

/usr/bin/npm:
	DEBIAN_FRONTEND=noninteractive apt-get install -y npm

/usr/bin/asyncapi:
	make /usr/bin/npm
	cd $(HOME) && curl -OL https://github.com/asyncapi/cli/releases/latest/download/asyncapi.deb
	cd $(HOME) && dpkg -i asyncapi.deb

/opt/homebrew/bin/asyncapi:
	npm install -g @asyncapi/cli

