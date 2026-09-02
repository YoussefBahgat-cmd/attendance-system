const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMKQ-N-w4BUqAWE4lNP6TrgUtTCbhatFkkEfdnYKs5ALBVpaWBaVYOK-AaI7jk-3LKSg/exec';
let currentStudent = null;
let actionInProgress = false;
let searchInProgress = false;
let lastScannedValue = '';
let scanLocked = false;
let scanner = null;

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
const clearAttendanceBtn = document.getElementById('clearAttendanceBtn');

window.addEventListener('DOMContentLoaded', () => {
    currentMonthLabel.textContent = new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date());
    scanBtn.addEventListener('click', searchStudent);
    payAndAttendBtn.addEventListener('click', () => completeAction('payAndRecordAttendance'));
    attendanceOnlyBtn.addEventListener('click', () => completeAction('recordAttendance'));
    clearAttendanceBtn.addEventListener('click', clearAttendance);
    studentIdInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') searchStudent();
    });
    startScanner();
});

function startScanner() {
    scanner = new Html5Qrcode('qrReader');
    scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decodedText => {
            if (scanLocked || searchInProgress || decodedText.trim() === lastScannedValue) return;
            lastScannedValue = decodedText.trim();
            studentIdInput.value = decodedText.trim();
            searchStudent();
        },
        () => {},
    ).catch(() => showError('اسمح للمتصفح باستخدام الكاميرا لعمل Scan'));
}

function clearAttendance() {
    if (!window.confirm('هل تريد مسح كل سجلات الحضور من ورقة Attendance؟ لن تتأثر بيانات الطلاب أو حالات الدفع.')) return;
    clearAttendanceBtn.disabled = true;
    const params = new URLSearchParams({ action: 'clearAttendance' });
    fetch(`${SCRIPT_URL}?${params}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (!data.success) throw new Error(data.message || 'فشل مسح سجل الحضور');
            studentInfo.classList.add('hidden');
            studentIdInput.value = '';
            showMessage('تم مسح سجل الحضور وبدء يوم جديد');
        })
        .catch(error => showError(error.message))
        .finally(() => {
            clearAttendanceBtn.disabled = false;
            studentIdInput.focus();
        });
}

function searchStudent() {
    const value = studentIdInput.value.trim();
    if (!value) return showError('امسح QR Code أو أدخل رقم الطالب');
    if (searchInProgress) return;
    searchInProgress = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch(`${SCRIPT_URL}?action=getStudent&studentId=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success) {
                scanLocked = true;
                displayStudent(data.student);
            }
            else showError(data.message || 'الطالب غير موجود');
        })
        .catch(error => showError(error.name === 'AbortError'
            ? 'انتهت مهلة الاتصال بملف Google Sheets'
            : 'حدث خطأ في الاتصال بملف Google Sheets'))
        .finally(() => {
            clearTimeout(timeout);
            searchInProgress = false;
            if (!studentInfo.classList.contains('hidden')) scanner?.pause(true);
            if (studentInfo.classList.contains('hidden')) {
                scanLocked = false;
                lastScannedValue = '';
            }
        });
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
            currentStudent = null;
            scanLocked = false;
            lastScannedValue = '';
            scanner?.resume();
            studentIdInput.value = '';
            studentIdInput.focus();
        })
        .catch(error => {
            scanLocked = false;
            lastScannedValue = '';
            scanner?.resume();
            showError(error.message);
        })
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

function showMessage(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}
