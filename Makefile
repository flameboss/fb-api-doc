
HTML_DIR = ../myflameboss/public/doc/api

ifeq ($(shell uname), Linux)

all:

else

all:	/opt/homebrew/bin/asyncapi html/index.html

html/index.html:	fb-api.yml
	asyncapi generate fromTemplate fb-api.yml @asyncapi/html-template@3.5.6 -o html --force-write -p sidebarOrganization=byTagsNoRoot

/opt/homebrew/bin/asyncapi:
	npm install -g @asyncapi/cli

endif

clean:
	rm -rf html

install:
	mkdir -p $(HTML_DIR)
	cp -r html/* $(HTML_DIR)/

start stop restart:
