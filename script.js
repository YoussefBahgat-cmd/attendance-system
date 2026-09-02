const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMKQ-N-w4BUqAWE4lNP6TrgUtTCbhatFkkEfdnYKs5ALBVpaWBaVYOK-AaI7jk-3LKSg/exec';
let currentStudent = null;
let actionInProgress = false;

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
const paymentStatusText = document.getElementById('paymentStatusText');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

window.addEventListener('DOMContentLoaded', () => {
    currentMonthLabel.textContent = new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date());
    scanBtn.addEventListener('click', searchStudent);
    payAndAttendBtn.addEventListener('click', () => completeAction('payAndRecordAttendance'));
    attendanceOnlyBtn.addEventListener('click', () => completeAction('recordAttendance'));
    studentIdInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') searchStudent();
    });
    startScanner();
});

function startScanner() {
    const scanner = new Html5Qrcode('qrReader');
    scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decodedText => {
            studentIdInput.value = decodedText.trim();
            searchStudent();
        },
        () => {},
    ).catch(() => showError('اسمح للمتصفح باستخدام الكاميرا لعمل Scan'));
}

function searchStudent() {
    const value = studentIdInput.value.trim();
    if (!value) return showError('امسح QR Code أو أدخل رقم الطالب');
    if (SCRIPT_URL === 'YOUR_SCRIPT_URL_HERE') return showError('ضع رابط Google Apps Script أولاً');

    fetch(`${SCRIPT_URL}?action=getStudent&studentId=${encodeURIComponent(value)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) displayStudent(data.student);
            else showError(data.message || 'الطالب غير موجود');
        })
        .catch(() => showError('حدث خطأ في الاتصال بملف Google Sheets'));
}

function displayStudent(student) {
    currentStudent = student;
    studentName.textContent = student.studentName;
    studentId.textContent = `رقم الطالب: ${student.studentId}`;
    studentGroup.textContent = `المجموعة: ${student.group}`;
    studentAvatar.textContent = student.studentName.charAt(0);
    const paid = String(student.status || '').trim() === 'مدفوع';
    paymentStatusText.textContent = paid ? 'مدفوع ✅' : 'غير مدفوع ❌';
    paymentStatusText.className = `payment-value ${paid ? 'paid' : 'unpaid'}`;
    payAndAttendBtn.disabled = paid;
    payAndAttendBtn.textContent = paid ? '💳 مدفوع بالفعل' : '💳 دفع وتسجيل حضور';
    attendanceOnlyBtn.disabled = false;
    statusBadge.innerHTML = '<span class="status-dot"></span><span class="status-text">جاهز للتسجيل</span>';
    studentInfo.classList.remove('hidden');
    hideError();
}

function completeAction(action) {
    if (!currentStudent || actionInProgress) return;
    actionInProgress = true;
    payAndAttendBtn.disabled = true;
    attendanceOnlyBtn.disabled = true;
    const params = new URLSearchParams({
        action,
        studentId: currentStudent.studentId,
        studentName: currentStudent.studentName,
        group: currentStudent.group,
    });
    fetch(`${SCRIPT_URL}?${params}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (!data.success) throw new Error(data.message || 'فشل تسجيل العملية');
            studentInfo.classList.add('hidden');
            studentIdInput.value = '';
            studentIdInput.focus();
        })
        .catch(error => showError(error.message))
        .finally(() => {
            actionInProgress = false;
            if (currentStudent && !studentInfo.classList.contains('hidden')) displayStudent(currentStudent);
        });
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
