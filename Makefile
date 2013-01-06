LIB_VERSION = 0.0.1

all: clean ender

ender: clean
	ender build ./src --output ./build/bitdeli-${LIB_VERSION} --sandbox

clean:
	rm -rf ./build/*
