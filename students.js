const SUPABASE_URL = "https://jflavxpfytmtkjkbielw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0QAerSSi6B9jOUufph_IOg_bcjQTEpJ";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const addStudentForm = document.getElementById('addStudentForm');
const newStudentIdInput = document.getElementById('newStudentId');
const newStudentNameInput = document.getElementById('newStudentName');
const newStudentGroupInput = document.getElementById('newStudentGroup');
const studentsTableBody = document.getElementById('studentsTableBody');
const searchInput = document.getElementById('searchInput');

const exportNewQrBtn = document.getElementById('exportNewQrBtn');
const exportAllStudentsBtn = document.getElementById('exportAllStudentsBtn');

let allStudentsList = [];

// المجموعات المتاحة
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

function getCurrentPaymentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
}

window.addEventListener('DOMContentLoaded', () => {
    loadStudents();
    populateGroupDropdown();
    
    if (exportNewQrBtn) exportNewQrBtn.addEventListener('click', exportNewStudentsForQR);
    if (exportAllStudentsBtn) exportAllStudentsBtn.addEventListener('click', exportAllStudentsWithPayment);
    if (addStudentForm) addStudentForm.addEventListener('submit', handleAddStudent);
    if (searchInput) searchInput.addEventListener('input', filterStudents);
});

// ملء القائمة المنسدلة
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

// جلب الطلاب من قاعدة البيانات
async function loadStudents() {
    try {
        const { data: students, error } = await db
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allStudentsList = students || [];
        
        generateNextStudentId(allStudentsList);
        filterStudents();

    } catch (err) {
        alert('حدث خطأ أثناء جلب بيانات الطلاب: ' + err.message);
    }
}

// توليد رقم الطالب التالي
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

// عرض النتائج في الجدول عند البحث فقط
function renderStudentsTable(students, isSearching) {
    studentsTableBody.innerHTML = '';

    if (!isSearching) {
        studentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #64748b; padding: 15px;">🔍 اكتب اسم الطالب أو الكود في خانة البحث للظهور</td></tr>';
        return;
    }

    if (students.length === 0) {
        studentsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #ef4444; padding: 15px;">لا يوجد طالب مطابق لهذا البحث</td></tr>';
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

// الفلترة الفورية
function filterStudents() {
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (!searchTerm) {
        renderStudentsTable([], false);
        return;
    }

    const filtered = allStudentsList.filter(student => {
        const nameMatch = student.student_name && student.student_name.toLowerCase().includes(searchTerm);
        const idMatch = student.student_id && student.student_id.toLowerCase().includes(searchTerm);
        
        return nameMatch || idMatch;
    });

    renderStudentsTable(filtered, true);
}

// إضافة طالب جديد
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
        
        if (searchInput) searchInput.value = '';
        loadStudents();

    } catch (err) {
        alert('فشل إضافة الطالب: ' + err.message);
    }
}

// تعديل بيانات طالب
async function openEditModal(id, code, currentName, currentGroup) {
    const newName = prompt(`تعديل اسم الطالب (${code}):`, currentName);
    if (newName === null) return;

    if (!newName.trim()) {
        alert("لا يمكن ترك الاسم فارغاً.");
        return;
    }

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

// حذف طالب
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

// 1. تصدير للطلاب الجدد المسجلين اليوم فقط (لطباعة الـ QR Code)
async function exportNewStudentsForQR() {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: newStudents, error } = await db
            .from('students')
            .select('*')
            .gte('created_at', todayStart.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!newStudents || newStudents.length === 0) {
            alert('لا يوجد طلاب جدد تم إضافتهم اليوم لتصديرهم!');
            return;
        }

        const excelData = newStudents.map(student => ({
            "كود الطالب (QR Code)": student.student_id,
            "اسم الطالب": student.student_name,
            "المجموعة": student.student_group,
            "تاريخ الإضافة": new Date(student.created_at).toLocaleDateString('ar-EG')
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب الجدد");

        const todayStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `الطلاب_الجدد_QR_${todayStr}.xlsx`);

    } catch (err) {
        alert('حدث خطأ أثناء تصدير الطلاب الجدد: ' + err.message);
    }
}

// 2. تصدير الشيت الشامل لكل الطلاب + حالة دفع الشهر الحالي
async function exportAllStudentsWithPayment() {
    try {
        const currentMonth = getCurrentPaymentMonth();

        const { data: students, error: studentErr } = await db
            .from('students')
            .select('*')
            .order('student_id', { ascending: true });

        if (studentErr) throw studentErr;

        const { data: payments, error: payErr } = await db
            .from('payments')
            .select('*')
            .eq('payment_month', currentMonth);

        if (payErr) throw payErr;

        const paidStudentIds = new Set(
            (payments || [])
                .filter(p => p.status === 'مدفوع')
                .map(p => p.student_id)
        );

        const excelData = students.map(student => {
            const isPaid = paidStudentIds.has(student.id);
            return {
                "كود الطالب": student.student_id,
                "اسم الطالب": student.student_name,
                "المجموعة": student.student_group,
                "حالة الدفع لشهر الحالي": isPaid ? "مدفوع ✅" : "غير مدفوع ❌"
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "كل الطلاب");

        XLSX.writeFile(workbook, `تقرير_كل_الطلاب_والمدفوعات_${currentMonth}.xlsx`);

    } catch (err) {
        alert('حدث خطأ أثناء تصدير تقرير الطلاب الشامل: ' + err.message);
    }
}
