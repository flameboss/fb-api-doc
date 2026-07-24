ARG BUILD_FROM
FROM ${BUILD_FROM}

# relay.py and requirements.txt are copied in from ../prototype by `make sync`
# (see Makefile). aiomqtt is pure-Python, so no build toolchain is needed.
COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

COPY relay.py /app/relay.py
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
