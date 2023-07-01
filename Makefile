OUT=tst-colored-sz.xpi
all: $(OUT)

FILES=$(shell cat files.txt)

$(OUT): $(FILES)
	-rm $@
	zip -r9 $@ $^
