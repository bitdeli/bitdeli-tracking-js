LIB_VERSION = 0.9.0
BUILD_DIR = ./build
OUTPUT = ${BUILD_DIR}/bitdeli-${LIB_VERSION}

all: build compile

clean:
	rm -f ${OUTPUT}.js ${OUTPUT}.min.js

build: clean
	mkdir -p ${BUILD_DIR}
	ender build . --output ${OUTPUT} --sandbox --minifier none

compile:
	ender compile --use ${OUTPUT}.js --output ${OUTPUT}.min.js --level simple
