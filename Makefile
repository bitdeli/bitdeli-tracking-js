BUILD_DIR = ./build
OUTPUT = ${BUILD_DIR}/bitdeli-0.0.1

all: build compile

clean:
	rm -rf ${BUILD_DIR}/*

build: clean
	ender build . --output ${OUTPUT} --sandbox --minifier none

compile:
	ender compile --use ${OUTPUT}.js --output ${OUTPUT}.min.js --level simple
