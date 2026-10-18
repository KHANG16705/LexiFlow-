export function parseText(text) {
 return text.replace(/^\uFEFF/,'').split(/\r?\n/).flatMap((line,i)=>{
  if(!line.trim()) return [];
  const c=[];let field='',quoted=false,malformed=false;
  for(let j=0;j<line.length;j++){
   const ch=line[j];
   if(quoted){if(ch==='"'&&line[j+1]==='"'){field+='"';j++;}else if(ch==='"')quoted=false;else field+=ch;}
   else if(ch===';' ){c.push(field);field='';}
   else if(ch==='"'&&field.trim()==='')quoted=true;
   else field+=ch;
  }
  c.push(field);
  if(quoted)malformed=true;
  const [termWithDetails='',...remaining]=c;
  const comma=termWithDetails.indexOf(',');
  const term=comma<0?termWithDetails.trim():termWithDetails.slice(0,comma).trim();
  const detailText=comma<0?'':termWithDetails.slice(comma+1);
  const detailComma=detailText.indexOf(',');
  const part_of_speech=detailComma<0?detailText.trim():detailText.slice(0,detailComma).trim();
  const newExample=detailComma<0?'':detailText.slice(detailComma+1).trim();
  const [pronunciation='',meaning='',example='',translation='',filename='']=remaining;
  const error=malformed?'Dấu nháy kép chưa được đóng.':c.length<3||c.length>6?'Cần từ 3 đến 6 cột, phân cách bằng dấu chấm phẩy.':!term||!meaning.trim()?'Thiếu từ vựng hoặc nghĩa.':term.length>255||pronunciation.trim().length>255?'Từ hoặc phiên âm vượt quá 255 ký tự.':part_of_speech.length>80?'Loại từ tối đa 80 ký tự.':null;
  return [{line:i+1,term,part_of_speech,pronunciation:pronunciation.trim(),meaning:meaning.trim(),example:newExample||example.trim(),translation:translation.trim(),filename:filename.trim(),error}];
 });
}
export function schedule(previous,rating,now=new Date()) {
 const old=Number(previous)||0;
 const days=rating==='again'?1/144:rating==='hard'?Math.max(1,old*1.2):rating==='good'?(old<1?1:old*2.5):Math.max(4,old*3.5);
 return {days,due:new Date(now.getTime()+days*86400000)};
}
