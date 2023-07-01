OUT=tst-colored-sz.xpi
all: $(OUT)

FILES=$(shell cat files.txt)

.PHONY: clean
clean:
	rm $(OUT)

$(OUT): $(FILES)
	-rm $@
	zip -r9 $@ $^
