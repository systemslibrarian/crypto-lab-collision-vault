# Independent Python 36-step compression verifier. See README for provenance.
import struct,hashlib,json
K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13]
IV=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
mask=0xffffffff
def r(x,n):return ((x>>n)|(x<<(32-n)))&mask
def comp(h,b):
 w=list(struct.unpack('>16I',b))
 for i in range(16,36):w.append((w[i-16]+(r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>3))+w[i-7]+(r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>10)))&mask)
 a,b,c,d,e,f,g,z=h
 for i in range(36):
  t1=(z+(r(e,6)^r(e,11)^r(e,25))+((e&f)^((~e)&g))+K[i]+w[i])&mask
  t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))&mask
  a,b,c,d,e,f,g,z=(t1+t2)&mask,a,b,c,(d+t1)&mask,e,f,g
 return [(x+y)&mask for x,y in zip(h,[a,b,c,d,e,f,g,z])]
from pathlib import Path
fixture=json.loads((Path(__file__).resolve().parents[1]/'src/research/sha256-pair.json').read_text())
a=bytes.fromhex(fixture['messageAHex']);b=bytes.fromhex(fixture['messageBHex'])
def digest(m):
 h=IV[:]
 for i in range(0,len(m),64):h=comp(h,m[i:i+64])
 return ''.join(f'{x:08x}' for x in h)
assert len(a)==len(b)==128 and a!=b and a[:64]==b[:64]
assert digest(a)==digest(b)==fixture['expectedCompressionHex']
assert hashlib.sha256(a).hexdigest()==fixture['fullSha256A']
assert hashlib.sha256(b).hexdigest()==fixture['fullSha256B']
assert fixture['fullSha256A']!=fixture['fullSha256B']
for bit in range(1024):
 altered=bytearray(b);altered[bit//8]^=1<<(bit%8)
 assert digest(altered)!=digest(a),bit
print('Independent Python verification: Table 2 reproduced; full SHA256 differs; all 1024 one-bit negative controls rejected.')
