const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib');
const {createBladeBuilder}=require(require('node:path').resolve(process.argv[2]));
const context={window:{}};vm.runInNewContext(fs.readFileSync(process.argv[3],'utf8'),context);
const builder=createBladeBuilder(context.window.DX_LOGO_SHAPES,context.window.DX_LOGO_META);
const vertices=[],indices=[],seen=new Map();
for(const shape of context.window.DX_LOGO_SHAPES){const g=builder.build(shape);const p=g.attributes.position.array,n=g.attributes.normal.array,c=g.attributes.color.array;
 for(let i=0;i<p.length;i+=3){const k=[...p.slice(i,i+3),...n.slice(i,i+3)].join(',');let index=seen.get(k);if(index===undefined){index=vertices.length;seen.set(k,index);vertices.push([...p.slice(i,i+3),...n.slice(i,i+3),...c.slice(i,i+3)]);}indices.push(index);}
 g.dispose();}
const buffer=Buffer.alloc(8+vertices.length*12+indices.length*4);buffer.writeUInt32LE(vertices.length,0);buffer.writeUInt32LE(indices.length,4);let o=8;
for(const v of vertices){for(let j=0;j<3;j++)buffer.writeInt16LE(Math.round(v[j]*8192),o+j*2);for(let j=0;j<3;j++)buffer.writeInt8(Math.round(v[3+j]*127),o+6+j);for(let j=0;j<3;j++)buffer.writeUInt8(Math.round(Math.max(0,Math.min(1,v[6+j]))*255),o+9+j);o+=12;}
for(const i of indices){buffer.writeUInt32LE(i,o);o+=4;}
const packed=zlib.gzipSync(buffer,{level:9});fs.writeFileSync(process.argv[4],packed);console.log(JSON.stringify({vertices:vertices.length,triangles:indices.length/3,gzipBytes:packed.length}));
