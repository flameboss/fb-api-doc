
HTML_DIR = ../myflameboss/public/doc/api

ifeq ($(shell uname), Linux)
OS_DEPS = /usr/bin/asyncapi
else
OS_DEPS = /opt/homebrew/bin/asyncapi
endif

all:	$(OS_DEPS) $(HTML_DIR)/index.html

$(HTML_DIR)/index.html:	fb-api.yml
	mkdir -p $(HTML_DIR)
	asyncapi generate fromTemplate fb-api.yml @asyncapi/html-template@3.0.0 -o $(HTML_DIR) --use-new-generator --force-write

clean:

install:

start stop restart:

/usr/bin/npm:
	DEBIAN_FRONTEND=noninteractive apt-get install -y npm

/usr/bin/asyncapi:
	make /usr/bin/npm
	cd $(HOME) && curl -OL https://github.com/asyncapi/cli/releases/latest/download/asyncapi.deb
	cd $(HOME) && dpkg -i asyncapi.deb

/opt/homebrew/bin/asyncapi:
	npm install -g @asyncapi/generator@2.6.0

