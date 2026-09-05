const SUPABASE_URL = "https://jflavxpfytmtkjkbielw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0QAerSSi6B9jOUufph_IOg_bcjQTEpJ";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const editSection = document.getElementById('editSection');
const editForm = document.getElementById('editForm');

const editRowId = document.getElementById('editRowId');
const editStudentCode = document.getElementById('editStudentCode');
const editStudentName = document.getElementById('editStudentName');
const editStudentGroup = document.getElementById('editStudentGroup');

let scanner = null;

window.addEventListener('DOMContentLoaded', () => {
    searchBtn.addEventListener('click', () => findStudent(searchInput.value.trim()));
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') findStudent(searchInput.value.trim()); });
    editForm.addEventListener('submit', handleUpdateStudent);
    
    startScanner();
});

// تشغيل كاميرا الـ QR Code للبحث المباشر
function startScanner() {
    scanner = new Html5Qrcode('qrReader');
    scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        decodedText => {
            searchInput.value = decodedText.trim();
            findStudent(decodedText.trim());
        },
        () => {}
    ).catch(err => console.log("الكاميرا غير متاحة أو تم الرفض."));
}

// البحث عن الطالب باستخدام الكود أو الاسم
async function findStudent(query) {
    if (!query) {
        alert("يرجى كتابة كود أو اسم الطالب أو مسح الـ QR");
        return;
    }

    try {
        // البحث بواسطة الكود أولاً أو الاسم
        const { data, error } = await db
            .from('students')
            .select('*')
            .or(`student_id.eq.${query},student_name.ilike.%${query}%`)
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            alert("لم يتم العثور على أي طالب بهذه البيانات!");
            editSection.classList.add('hidden');
            return;
        }

        const student = data[0];
        
        // تعبئة البيانات في نموذج التعديل
        editRowId.value = student.id;
        editStudentCode.value = student.student_id;
        editStudentName.value = student.student_name;
        editStudentGroup.value = student.student_group || "";

        editSection.classList.remove('hidden');

    } catch (err) {
        alert("حدث خطأ أثناء البحث: " + err.message);
    }
}

// حفظ التعديلات في Supabase
async function handleUpdateStudent(e) {
    e.preventDefault();

    const id = editRowId.value;
    const updatedName = editStudentName.value.trim();
    const updatedGroup = editStudentGroup.value;

    if (!updatedName || !updatedGroup) {
        alert("يرجى استكمال جميع البيانات");
        return;
    }

    try {
        const { error } = await db
            .from('students')
            .update({
                student_name: updatedName,
                student_group: updatedGroup
            })
            .eq('id', id);

        if (error) throw error;

        alert("تم تعديل بيانات الطالب بنجاح ✅");
        editSection.classList.add('hidden');
        searchInput.value = '';

    } catch (err) {
        alert("فشل تحديث البيانات: " + err.message);
    }
}