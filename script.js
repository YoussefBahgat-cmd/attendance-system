// ===== الإعدادات =====
const SCRIPT_URL = 'YOUR_SCRIPT_URL_HERE';
const MONTHLY_FEE = 250;
let currentStudent = null;
let attendanceData = [];
let allStudentsData = [];

// ===== عناصر DOM =====
const studentIdInput = document.getElementById('studentIdInput');
const scanBtn = document.getElementById('scanBtn');
const studentInfo = document.getElementById('studentInfo');
const studentName = document.getElementById('studentName');
const studentId = document.getElementById('studentId');
const studentGroup = document.getElementById('studentGroup');
const studentAvatar = document.getElementById('studentAvatar');
const statusBadge = document.getElementById('statusBadge');
const payAndAttendBtn = document.getElementById('payAndAttendBtn');
const attendanceOnlyBtn = document.getElementById('attendanceOnlyBtn');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const totalToday = document.getElementById('totalToday');
const lastTime = document.getElementById('lastTime');
const totalStudents = document.getElementById('totalStudents');
const attendanceBody = document.getElementById('attendanceBody');
const noRecords = document.getElementById('noRecords');
const exportBtn = document.getElementById('exportBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const paymentStatusText = document.getElementById('paymentStatusText');
const paidAmount = document.getElementById('paidAmount');
const remainingAmount = document.getElementById('remainingAmount');
const clearAttendanceBtn = document.getElementById('clearAttendanceBtn');
const unpaidBtn = document.getElementById('unpaidBtn');
const unpaidModal = document.getElementById('unpaidModal');
const closeModal = document.getElementById('closeModal');
const unpaidBody = document.getElementById('unpaidBody');
const unpaidTable = document.getElementById('unpaidTable');
const noUnpaid = document.getElementById('noUnpaid');
const modalMonthLabel = document.getElementById('modalMonthLabel');
const studentsMonthLabel = document.getElementById('studentsMonthLabel');
const studentsBody = document.getElementById('studentsBody');

// ===== بيانات تجريبية (للتشغيل المحلي بدون Google Sheets) =====
const demoStudents = [
    { id: 'STU_001', name: 'أحمد محمد علي', group: 'A', payments: { '2026-09': 250, '2026-08': 250 } },
    { id: 'STU_002', name: 'محمد أحمد سالم', group: 'A', payments: { '2026-09': 100, '2026-08': 250 } },
    { id: 'STU_003', name: 'علي محمود إبراهيم', group: 'B', payments: { '2026-09': 0, '2026-08': 250 } },
    { id: 'STU_004', name: 'خالد عمر حسن', group: 'B', payments: { '2026-09': 250, '2026-08': 200 } },
    { id: 'STU_005', name: 'يوسف سعيد محمود', group: 'A', payments: { '2026-09': 150, '2026-08': 250 } }
];

// ===== التهيئة =====
document.addEventListener('DOMContentLoaded', () => {
    updateMonthLabels();
    displayStudents();
    loadStatistics();
    loadAttendanceData();
    
    studentIdInput.focus();
    
    studentIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStudent();
    });
    
    scanBtn.addEventListener('click', searchStudent);
    payAndAttendBtn.addEventListener('click', () => completeStudentAction(true));
    attendanceOnlyBtn.addEventListener('click', () => completeStudentAction(false));
    exportBtn.addEventListener('click', exportToExcel);
    clearAttendanceBtn.addEventListener('click', clearAttendance);
    unpaidBtn.addEventListener('click', showUnpaidStudents);
    closeModal.addEventListener('click', () => unpaidModal.classList.add('hidden'));
    unpaidModal.addEventListener('click', (e) => {
        if (e.target === unpaidModal) unpaidModal.classList.add('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.modal') && !e.target.closest('#unpaidBtn')) {
            // keep focus on input
        }
        studentIdInput.focus();
    });
});

// ===== تحديد الشهر الحالي =====
function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthName() {
    const months = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return months[new Date().getMonth()];
}

function updateMonthLabels() {
    const monthName = getCurrentMonthName();
    currentMonthLabel.textContent = `شهر ${monthName}`;
    modalMonthLabel.textContent = `شهر ${monthName}`;
    studentsMonthLabel.textContent = `شهر ${monthName}`;
}

function displayStudents() {
    studentsBody.innerHTML = '';
    demoStudents.forEach((student, index) => {
        const payment = getPaymentStatus(student);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${student.group}</td>
            <td><span class="payment-value ${payment.status}">${payment.statusText}</span></td>
            <td>${payment.paid} ج.م</td>
            <td class="remaining-cell">${payment.remaining} ج.م</td>
        `;
        studentsBody.appendChild(row);
    });
}

// ===== حساب حالة الدفع =====
function getPaymentStatus(student) {
    const monthKey = getCurrentMonthKey();
    const paid = student.paymentMonth === monthKey ? Number(student.paidAmount || 0) : (student.payments?.[monthKey] || 0);
    const remaining = MONTHLY_FEE - paid;
    
    let status = 'unpaid';
    let statusText = 'غير مدفوع ❌';
    
    if (paid >= MONTHLY_FEE) {
        status = 'paid';
        statusText = 'مدفوع بالكامل ✅';
    } else if (paid > 0) {
        status = 'partial';
        statusText = 'مدفوع جزئياً ⚠️';
    }
    
    return { paid, remaining, status, statusText };
}

// ===== البحث عن طالب =====
function searchStudent() {
    const studentIdValue = studentIdInput.value.trim();
    if (!studentIdValue) {
        showError('الرجاء إدخال رقم الطالب أو مسح QR Code');
        return;
    }
    
    const cleanId = cleanStudentId(studentIdValue);

    if (SCRIPT_URL !== 'YOUR_SCRIPT_URL_HERE') {
        fetch(`${SCRIPT_URL}?action=getStudent&studentId=${encodeURIComponent(cleanId)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayStudent(normalizeStudent(data.student));
                    hideError();
                } else {
                    showError(data.message || 'الطالب غير موجود');
                    hideStudentInfo();
                }
            })
            .catch(() => {
                showError('حدث خطأ في الاتصال بالخادم');
                hideStudentInfo();
            });
        return;
    }
    
    // للتشغيل المحلي (Demo)
    const student = demoStudents.find(s => s.id === cleanId);
    if (student) {
        displayStudent(student);
        hideError();
    } else {
        showError('الطالب غير موجود');
        hideStudentInfo();
    }
    
    /* 
    // للتشغيل مع Google Sheets (فعل هذا عند ربط السكربت)
    fetch(`${SCRIPT_URL}?action=getStudent&studentId=${cleanId}`)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                displayStudent(data.student);
                hideError();
            } else {
                showError(data.message || 'الطالب غير موجود');
                hideStudentInfo();
            }
        })
        .catch(() => {
            showError('حدث خطأ في الاتصال بالخادم');
            hideStudentInfo();
        });
    */
}

function normalizeStudent(student) {
    return {
        ...student,
        id: student.id || student.studentId,
        name: student.name || student.studentName,
    };
}

// ===== عرض بيانات الطالب =====
function displayStudent(student) {
    currentStudent = student;
    
    studentName.textContent = student.name;
    studentId.textContent = `رقم الطالب: ${student.id}`;
    studentGroup.textContent = `المجموعة: ${student.group}`;
    
    const nameParts = student.name.split(' ');
    const initials = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
    studentAvatar.textContent = initials;
    
    // عرض معلومات الدفع
    const payment = getPaymentStatus(student);
    paymentStatusText.textContent = payment.statusText;
    paymentStatusText.className = 'payment-value ' + payment.status;
    paidAmount.textContent = payment.paid + ' ج.م';
    remainingAmount.textContent = payment.remaining + ' ج.م';
    
    // تحديث حالة التسجيل
    const alreadyRegistered = attendanceData.some(r => r.studentId === student.id);
    if (alreadyRegistered) {
        statusBadge.innerHTML = `<span class="status-dot" style="background: #f59e0b;"></span><span class="status-text" style="color: #f59e0b;">مسجل مسبقاً</span>`;
        payAndAttendBtn.disabled = true;
        attendanceOnlyBtn.disabled = true;
        payAndAttendBtn.style.opacity = '0.5';
        attendanceOnlyBtn.style.opacity = '0.5';
    } else {
        statusBadge.innerHTML = `<span class="status-dot"></span><span class="status-text">جاهز للتسجيل</span>`;
        const isPaid = payment.status === 'paid';
        payAndAttendBtn.disabled = isPaid;
        attendanceOnlyBtn.disabled = false;
        payAndAttendBtn.style.opacity = isPaid ? '0.5' : '1';
        attendanceOnlyBtn.style.opacity = '1';
        payAndAttendBtn.textContent = isPaid ? '💳 مدفوع بالفعل' : '💳 دفع وتسجيل حضور';
    }
    
    studentInfo.classList.remove('hidden');
    studentInfo.style.animation = 'slideIn 0.3s ease';
}

function hideStudentInfo() {
    studentInfo.classList.add('hidden');
    currentStudent = null;
}

// ===== تأكيد الحضور =====
function completeStudentAction(shouldPay) {
    if (!currentStudent) {
        showError('الرجاء البحث عن طالب أولاً');
        return;
    }
    const alreadyRegistered = attendanceData.some(r => r.studentId === currentStudent.id);
    if (alreadyRegistered) {
        showError('هذا الطالب مسجل مسبقاً اليوم');
        return;
    }

    if (SCRIPT_URL !== 'YOUR_SCRIPT_URL_HERE') {
        const action = shouldPay ? 'payAndRecordAttendance' : 'recordAttendance';
        fetch(`${SCRIPT_URL}?action=${action}&studentId=${encodeURIComponent(currentStudent.id)}&studentName=${encodeURIComponent(currentStudent.name)}&group=${encodeURIComponent(currentStudent.group)}&paymentStatus=${encodeURIComponent(getPaymentStatus(currentStudent).statusText)}`, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    showError(data.message || 'فشل تسجيل العملية');
                    return;
                }
                showToast(shouldPay ? 'تم تسجيل الدفع والحضور بنجاح' : 'تم تسجيل الحضور بنجاح');
                studentIdInput.value = '';
                hideStudentInfo();
            })
            .catch(() => showError('حدث خطأ في الاتصال بالخادم'));
        return;
    }

    if (shouldPay) {
        const payment = getPaymentStatus(currentStudent);
        if (payment.status === 'paid') {
            showError('هذا الطالب مدفوع بالفعل لهذا الشهر');
            return;
        }
        currentStudent.paymentMonth = getCurrentMonthKey();
        currentStudent.paidAmount = MONTHLY_FEE;
        currentStudent.payments = { ...(currentStudent.payments || {}), [getCurrentMonthKey()]: MONTHLY_FEE };
    }
    
    const record = {
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        group: currentStudent.group,
        paymentStatus: getPaymentStatus(currentStudent).statusText,
        timestamp: new Date().toLocaleString('ar-EG')
    };
    
    attendanceData.unshift(record);
    displayAttendance();
    displayStudents();
    loadStatistics();
    
    showToast(shouldPay ? 'تم تسجيل الدفع والحضور بنجاح' : 'تم تسجيل الحضور بنجاح');
    displayStudent(currentStudent);
    
    studentIdInput.value = '';
    studentIdInput.focus();
    
    /*
    fetch(`${SCRIPT_URL}?action=registerAttendance&studentId=${currentStudent.id}`, { method: 'POST' })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast('تم تسجيل الحضور بنجاح');
                loadStatistics();
                loadAttendanceData();
                studentIdInput.value = '';
                studentIdInput.focus();
            } else {
                showError(data.message || 'فشل تسجيل الحضور');
            }
        })
        .catch(() => showError('حدث خطأ في تسجيل الحضور'));
    */
}

// ===== مسح سجل الحضور =====
function clearAttendance() {
    if (attendanceData.length === 0) {
        showError('لا يوجد سجلات لمسحها');
        return;
    }
    if (!confirm('هل أنت متأكد من مسح سجل الحضور اليوم؟')) return;
    
    attendanceData = [];
    displayAttendance();
    loadStatistics();
    hideStudentInfo();
    showToast('تم مسح سجل الحضور');
    
    /*
    fetch(`${SCRIPT_URL}?action=clearAttendance`, { method: 'POST' })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                attendanceData = [];
                displayAttendance();
                loadStatistics();
                showToast('تم مسح سجل الحضور');
            }
        })
        .catch(() => showError('حدث خطأ في مسح السجل'));
    */
}

// ===== عرض الطلاب غير المدفوعين =====
function showUnpaidStudents() {
    const monthKey = getCurrentMonthKey();
    const unpaidList = [];
    
    demoStudents.forEach(student => {
        const payment = getPaymentStatus(student);
        if (payment.status !== 'paid') {
            unpaidList.push({
                ...student,
                paid: payment.paid,
                    remaining: payment.remaining,
                    status: payment.status,
                    statusText: payment.statusText
            });
        }
    });
    
    unpaidBody.innerHTML = '';
    if (unpaidList.length === 0) {
        noUnpaid.classList.remove('hidden');
        unpaidTable.classList.add('hidden');
    } else {
        noUnpaid.classList.add('hidden');
        unpaidTable.classList.remove('hidden');
        
        unpaidList.forEach((student, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.group}</td>
                <td><span class="payment-value ${student.status}">${student.statusText}</span></td>
                <td>${student.paid} ج.م</td>
                <td class="remaining-cell">${student.remaining} ج.م</td>
            `;
            unpaidBody.appendChild(row);
        });
    }
    
    unpaidModal.classList.remove('hidden');
    
    /*
    fetch(`${SCRIPT_URL}?action=getUnpaidStudents&month=${monthKey}`)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                // populate modal with data.unpaidStudents
            }
        });
    */
}

// ===== الإحصائيات =====
function loadStatistics() {
    totalToday.textContent = attendanceData.length;
    lastTime.textContent = attendanceData.length > 0 ? attendanceData[0].timestamp : '-';
    totalStudents.textContent = demoStudents.length;
    
    /*
    fetch(`${SCRIPT_URL}?action=getStatistics`)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                totalToday.textContent = data.stats.todayCount;
                lastTime.textContent = data.stats.lastTime || '-';
                totalStudents.textContent = data.stats.totalStudents;
            }
        });
    */
}

// ===== عرض سجل الحضور =====
function displayAttendance() {
    attendanceBody.innerHTML = '';
    if (attendanceData.length === 0) {
        noRecords.classList.remove('hidden');
        document.getElementById('attendanceTable').classList.add('hidden');
        return;
    }
    noRecords.classList.add('hidden');
    document.getElementById('attendanceTable').classList.remove('hidden');
    
    attendanceData.forEach((record, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${record.studentId}</td>
            <td>${record.studentName}</td>
            <td>${record.group}</td>
            <td><span class="payment-value ${record.paymentStatus === 'مدفوع بالكامل ✅' ? 'paid' : 'unpaid'}">${record.paymentStatus || 'غير مدفوع ❌'}</span></td>
            <td>${record.timestamp}</td>
        `;
        attendanceBody.appendChild(row);
    });
}

function loadAttendanceData() {
    displayAttendance();
}

// ===== تصدير =====
function exportToExcel() {
    if (attendanceData.length === 0) {
        showError('لا توجد بيانات للتصدير');
        return;
    }
    let csv = 'رقم الطالب,اسم الطالب,المجموعة,وقت التسجيل\n';
    attendanceData.forEach(r => {
        csv += `${r.studentId},${r.studentName},${r.group},${r.timestamp}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير البيانات بنجاح');
}

// ===== مساعدات =====
function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => errorMessage.classList.add('hidden'), 5000);
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function cleanStudentId(id) {
    id = id.trim().toUpperCase();
    if (!id.startsWith('STU_')) {
        if (/^\d+$/.test(id)) {
            id = 'STU_' + id.padStart(3, '0');
        } else {
            id = 'STU_' + id;
        }
    }
    return id;
}