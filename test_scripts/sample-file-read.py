import sys
f = open("test_scripts/test.txt", "r")
sys.stdout.write(str(f.read()))