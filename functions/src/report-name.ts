export function reportName(name:string,last4:string,date:Date){
 const safe=name.normalize('NFC').replace(/[^\p{L}\p{N} -]/gu,'').trim()
 if(!safe||safe.length>30||!/^\d{4}$/.test(last4)||!Number.isFinite(date.getTime()))throw Error('Invalid report name')
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date).replaceAll('-','').slice(2)
 return `${day}_${safe}_${last4}.pdf`
}
export const validReportName=(value:unknown):value is string=>typeof value==='string'&&/^\d{6}_[\p{L}\p{N} -]{1,30}_\d{4}\.pdf$/u.test(value)
