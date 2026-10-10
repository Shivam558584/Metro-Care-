import type { Complaint, ReplyLanguage } from "../types"

const intros: Record<ReplyLanguage, string> = {
  English: "Thank you for reporting this issue",
  ગુજરાતી: "આ સમસ્યાની જાણ કરવા બદલ આભાર",
  हिन्दी: "इस समस्या की सूचना देने के लिए धन्यवाद",
}

export function createDraftReply(
  complaint: Complaint,
  language: ReplyLanguage,
) {
  const safety = complaint.category === "Safety"
  if (language === "ગુજરાતી") {
    return `${intros[language]}. ${complaint.station} સ્ટેશન પરની તમારી ${complaint.category} ફરિયાદ (${complaint.id}) નોંધવામાં આવી છે. ${
      safety
        ? "તે તાત્કાલિક માનવ સમીક્ષા માટે સલામતી ટીમને મોકલવામાં આવી છે. તાત્કાલિક જોખમ હોય તો સ્ટેશન સ્ટાફનો સીધો સંપર્ક કરો."
        : "સંબંધિત ટીમ પરિસ્થિતિની સમીક્ષા કરશે. વધુ માહિતી ઉપલબ્ધ થાય ત્યારે સ્ટાફ દ્વારા અપડેટ આપવામાં આવશે."
    }`
  }
  if (language === "हिन्दी") {
    return `${intros[language]}। ${complaint.station} स्टेशन पर आपकी ${complaint.category} शिकायत (${complaint.id}) दर्ज की गई है। ${
      safety
        ? "इसे तत्काल मानवीय समीक्षा के लिए सुरक्षा टीम को भेजा गया है। तत्काल खतरा होने पर सीधे स्टेशन स्टाफ से संपर्क करें।"
        : "संबंधित टीम स्थिति की समीक्षा करेगी। अधिक जानकारी उपलब्ध होने पर स्टाफ अपडेट देगा।"
    }`
  }
  return `${intros[language]}. Your ${complaint.category.toLowerCase()} complaint at ${complaint.station} (${complaint.id}) has been recorded. ${
    safety
      ? "It has been escalated to the safety team for immediate human review. If there is an immediate danger, contact station staff directly."
      : "The relevant team will review the situation. Staff will provide an update when more information is available."
  }`
}
