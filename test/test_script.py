import sys, json

args = json.loads(sys.argv[1]);

a = args['a']

#Testing the wdir
f= open("write_test.txt","w+") #should create file in wdir.
f.write(a + 1)
f.close

print(a + 1)