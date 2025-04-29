
HTML_DIR = ../myflameboss/public/doc/api

ifeq ($(shell uname), Linux)
OS_DEPS = /usr/bin/asyncapi
else
OS_DEPS = /opt/homebrew/bin/asyncapi
endif

all:	$(OS_DEPS)
	mkdir -p $(HTML_DIR)
	asyncapi generate fromTemplate fb-api.yml @asyncapi/html-template@3.0.0 -o $(HTML_DIR) --use-new-generator --force-write

clean:

install:

restart:


/usr/bin/asyncapi:
	DEBIAN_FRONTEND=noninteractive apt-get install -y npm
	npm install -g @asyncapi/generator@2.6.0

/opt/homebrew/bin/asyncapi:
	npm install -g @asyncapi/generator@2.6.0

