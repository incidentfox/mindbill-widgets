const tag = process.argv[2];
if (!/^sdk-v\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/.test(tag ?? "")) {
  throw new Error("Release tag must use sdk-vYYYY.MM.DD or sdk-vYYYY.MM.DD.N");
}
