const SUPABASE_URL = "https://jflavxpfytmtkjkbielw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0QAerSSi6B9jOUufph_IOg_bcjQTEpJ";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const addStudentForm = document.getElementById('addStudentForm');
const newStudentIdInput = document.getElementById('newStudentId');
const newStudentNameInput = document.getElementById('newStudentName');
const newStudentGroupInput = document.getElementById('newStudentGroup');
const studentsTableBody = document.getElementById('studentsTableBody');
const exportQrExcelBtn = document.getElementById('exportQrExcelBtn');
const searchInput = document.getElementById('searchInput');

let allStudentsList = [];

// المجموعات المتاحة ثابتة لمنع خطأ Data Inconsistency
const AVAILABLE_GROUPS = [
    "س ث 1:30",
    "س ث 5",
    "ح ع 12",
    "ح ع 3",
    "ث خ 1:30",
    "ث خ 3",
    "ث خ 5",
    "ث خ 6:30"
];

window.addEventListener('DOMContentLoaded', () => {
    loadStudents();
    populateGroupDropdown();
    
    if (exportQrExcelBtn) exportQrExcelBtn.addEventListener('click', exportStudentsForQR);
    if (addStudentForm) addStudentForm.addEventListener('submit', handleAddStudent);
    if (searchInput) searchInput.addEventListener('input', filterStudents);
});

// 1. ملء القائمة المنسدلة الخاصة بإضافة طالب جديد تلقائياً
function populateGroupDropdown() {
    if (!newStudentGroupInput || newStudentGroupInput.tagName !== 'SELECT') return;

    newStudentGroupInput.innerHTML = '<option value="">-- اختر المجموعة --</option>';
    AVAILABLE_GROUPS.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        newStudentGroupInput.appendChild(option);
    });
}

// 2. جلب قائمة الطلاب من Supabase
async function loadStudents() {
    try {
        const { data: students, error } = await db
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allStudentsList = students || [];
        renderStudentsTable(allStudentsList);
        generateNextStudentId(allStudentsList);

    } catch (err) {
        alert('حدث خطأ أثناء جلب بيانات الطلاب: ' + err.message);
    }
}

// 3. توليد الكود التلقائي (STUD-557...)
function generateNextStudentId(students) {
    let maxNumber = 0;

    students.forEach(s => {
        if (s.student_id && s.student_id.startsWith('STUD-')) {
            const num = parseInt(s.student_id.replace('STUD-', ''), 10);
            if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
            }
        }
    });

    const nextNumber = maxNumber + 1;
    const paddedNumber = String(nextNumber).padStart(3, '0');
    if (newStudentIdInput) newStudentIdInput.value = `STUD-${paddedNumber}`;
}

// 4. عرض البيانات داخل الجدول وإضافة أزرار التعديل والحذف
function renderStudentsTable(students) {
    studentsTableBody.innerHTML = '';

    if (students.length === 0) {
        studentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا يوجد طلاب مطابقون للبحث</td></tr>';
        return;
    }

    students.forEach(student => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${student.student_id}</strong></td>
            <td>${student.student_name}</td>
            <td><span class="badge bg-secondary" style="padding: 4px 8px; border-radius: 4px; background: #e2e8f0; font-weight: 600;">${student.student_group}</span></td>
            <td>
                <button onclick="openEditModal('${student.id}', '${student.student_id}', '${student.student_name}', '${student.student_group}')" class="btn btn-warning" style="padding: 5px 10px; font-size: 0.85rem; margin-left: 5px; background-color: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer;">تعديل ✏️</button>
                <button onclick="deleteStudent('${student.id}', '${student.student_name}')" class="btn btn-danger" style="padding: 5px 10px; font-size: 0.85rem; background-color: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">حذف 🗑️</button>
            </td>
        `;
        studentsTableBody.appendChild(tr);
    });
}

// 5. الفلترة المباشرة بالاسم أو الكود
function filterStudents() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filtered = allStudentsList.filter(student => {
        const nameMatch = student.student_name && student.student_name.toLowerCase().includes(searchTerm);
        const idMatch = student.student_id && student.student_id.toLowerCase().includes(searchTerm);
        
        return nameMatch || idMatch;
    });

    renderStudentsTable(filtered);
}

// 6. إضافة طالب جديد
async function handleAddStudent(e) {
    e.preventDefault();

    const studentId = newStudentIdInput.value.trim();
    const studentName = newStudentNameInput.value.trim();
    const studentGroup = newStudentGroupInput.value.trim();

    if (!studentId || !studentName || !studentGroup) {
        alert("يرجى اختيار المجموعة وإدخال اسم الطالب بالكامل");
        return;
    }

    try {
        const { error } = await db
            .from('students')
            .insert([{
                student_id: studentId,
                student_name: studentName,
                student_group: studentGroup
            }]);

        if (error) throw error;

        newStudentNameInput.value = '';
        newStudentGroupInput.value = '';
        alert('تمت إضافة الطالب بنجاح ✅');
        loadStudents();

    } catch (err) {
        alert('فشل إضافة الطالب: ' + err.message);
    }
}

// 7. نافذة حوار لتعديل بيانات الطالب (تغيير الاسم أو المجموعة)
async function openEditModal(id, code, currentName, currentGroup) {
    const newName = prompt(`تعديل اسم الطالب (${code}):`, currentName);
    if (newName === null) return; // تم إلغاء العملية

    if (!newName.trim()) {
        alert("لا يمكن ترك الاسم فارغاً.");
        return;
    }

    // بناء خيارات المجموعة للاختيار منها
    let groupOptionsText = AVAILABLE_GROUPS.map((g, index) => `${index + 1}. ${g}`).join('\n');
    let groupChoice = prompt(`اختر رقم المجموعة الجديدة للطالب:\n\n${groupOptionsText}\n\n(المجموعة الحالية: ${currentGroup})`);

    let selectedGroup = currentGroup;
    if (groupChoice !== null && groupChoice.trim() !== '') {
        const selectedIndex = parseInt(groupChoice.trim(), 10) - 1;
        if (!isNaN(selectedIndex) && AVAILABLE_GROUPS[selectedIndex]) {
            selectedGroup = AVAILABLE_GROUPS[selectedIndex];
        } else {
            alert("اختيار رقم المجموعة غير صحيح، تم الاحتفاظ بالمجموعة الحالية.");
        }
    }

    try {
        const { error } = await db
            .from('students')
            .update({
                student_name: newName.trim(),
                student_group: selectedGroup
            })
            .eq('id', id);

        if (error) throw error;

        alert('تم تعديل بيانات الطالب بنجاح ✅');
        loadStudents();

    } catch (err) {
        alert('حدث خطأ أثناء تعديل البيانات: ' + err.message);
    }
}

// 8. حذف طالب
async function deleteStudent(id, name) {
    if (!confirm(`هل أنت تأكد من حذف الطالب (${name})؟`)) return;

    try {
        const { error } = await db
            .from('students')
            .delete()
            .eq('id', id);

        if (error) throw error;

        loadStudents();
    } catch (err) {
        alert('حدث خطأ أثناء الحذف: ' + err.message);
    }
}

// 9. تصدير لملف Excel
function exportStudentsForQR() {
    if (allStudentsList.length === 0) {
        alert('لا توجد بيانات طلاب للتصدير!');
        return;
    }

    const excelData = allStudentsList.map(student => ({
        "كود الطالب (QR Code)": student.student_id,
        "اسم الطالب": student.student_name,
        "المجموعة": student.student_group
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");

    XLSX.writeFile(workbook, `قائمة_الطلاب_طباعة_QR.xlsx`);
}