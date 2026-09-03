// 1. بيانات الاتصال بقاعدة بيانات Supabase
const SUPABASE_URL = "https://nfegjcgffqhoanhunrha.supabase.co";
// ⚠️ استبدل النص أدناه بمفتاح anon public الصحيح الذي نسخته من Supabase
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZWdqY2dmZnFob2FuaHVucmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjY3MjcsImV4cCI6MjEwNDA0MjcyN30.58u3oDaF7L3kvAHy1XEguH0Sx8P0jp72eviWHkmN47M";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. العناصر والمتغيرات العامة
let actionInProgress = false;
let searchInProgress = false;
let scanLocked = false;
let scanner = null;
let currentStudent = null;

const studentIdInput = document.getElementById('studentIdInput');
const scanBtn = document.getElementById('scanBtn');
const studentInfo = document.getElementById('studentInfo');
const studentName = document.getElementById('studentName');
const studentId = document.getElementById('studentId');
const studentGroup = document.getElementById('studentGroup');
const statusBadge = document.getElementById('statusBadge');
const payAndAttendBtn = document.getElementById('payAndAttendBtn');
const attendanceOnlyBtn = document.getElementById('attendanceOnlyBtn');
const paymentStatusText = document.getElementById('paymentStatusText');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const clearAttendanceBtn = document.getElementById('clearAttendanceBtn');

// 3. دالة جلب بداية الشهر الحالي ديناميكياً (YYYY-MM-01)
function getCurrentPaymentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
}

// 4. تشغيل صوت التنبيه فور القراءة
function playBeepSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        console.log('صوت التنبيه غير مدعوم أو يتطلب تفاعل مع الصفحة أولاً');
    }
}

// 5. تهيئة الأحداث عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
    if (currentMonthLabel) {
        currentMonthLabel.textContent = new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date());
    }

    scanBtn.addEventListener('click', searchStudent);
    payAndAttendBtn.addEventListener('click', () => completeAction('payAndRecordAttendance'));
    attendanceOnlyBtn.addEventListener('click', () => completeAction('recordAttendance'));
    clearAttendanceBtn.addEventListener('click', clearAttendance);

    studentIdInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') searchStudent();
    });

    startScanner();
});

// 6. تشغيل ماسح الـ QR Code وإيقافه فور القراءة
function startScanner() {
    scanner = new Html5Qrcode('qrReader');
    scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decodedText => {
            if (scanLocked || searchInProgress) return;

            scanLocked = true;
            playBeepSound();
            scanner.pause(true);

            studentIdInput.value = decodedText.trim();
            searchStudent();
        },
        () => {}
    ).catch(() => showError('اسمح للمتصفح باستخدام الكاميرا لعمل Scan'));
}

// 7. البحث عن الطالب في Supabase
async function searchStudent() {
    const value = studentIdInput.value.trim();
    if (!value) {
        scanLocked = false;
        scanner?.resume();
        return showError('امسح QR Code أو أدخل رقم الطالب');
    }

    if (searchInProgress) return;
    searchInProgress = true;
    hideError();

    try {
        const { data: student, error: studentError } = await db
            .from('students')
            .select('*')
            .eq('student_id', value)
            .maybeSingle();

        if (studentError) {
            console.error('Database Error:', studentError);
            throw studentError;
        }

        if (!student) {
            showError('الطالب غير موجود في قاعدة البيانات!');
            resetCardUI();
            return;
        }

        const currentMonth = getCurrentPaymentMonth();

        const { data: payment } = await db
            .from('payments')
            .select('*')
            .eq('student_id', student.id)
            .eq('payment_month', currentMonth)
            .maybeSingle();

        const paymentStatus = payment ? payment.status : 'غير مدفوع';

        displayStudent({
            id: student.id,
            studentId: student.student_id,
            studentName: student.student_name,
            group: student.student_group,
            status: paymentStatus
        });

    } catch (err) {
        console.error(err);
        showError('حدث خطأ أثناء الاتصال بقاعدة البيانات. قم بمراجعة المفتاح والصلاحيات.');
        resetCardUI();
    } finally {
        searchInProgress = false;
    }
}

// 8. عرض بيانات الطالب وتحديث الواجهة
function displayStudent(student) {
    currentStudent = student;
    studentName.textContent = student.studentName;
    studentId.textContent = student.studentId;
    studentGroup.textContent = student.group;

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

// 9. تنفيذ عمليات الدفع والحضور
async function completeAction(action) {
    if (!currentStudent || actionInProgress) return;

    actionInProgress = true;
    payAndAttendBtn.disabled = true;
    attendanceOnlyBtn.disabled = true;

    try {
        let paymentStatus = currentStudent.status;
        const currentMonth = getCurrentPaymentMonth();

        if (action === 'payAndRecordAttendance') {
            const { error: payError } = await db
                .from('payments')
                .upsert({
                    student_id: currentStudent.id,
                    payment_month: currentMonth,
                    status: 'مدفوع',
                    paid_at: new Date().toISOString()
                }, { onConflict: 'student_id, payment_month' });

            if (payError) throw payError;
            paymentStatus = 'مدفوع';
        }

        const { error: attendError } = await db
            .from('attendance')
            .insert([{
                student_id: currentStudent.id,
                payment_status: paymentStatus
            }]);

        if (attendError) {
            if (attendError.code === '23505') {
                throw new Error('تنبيه: تم تسجيل حضور هذا الطالب اليوم بالفعل!');
            } else {
                throw attendError;
            }
        }

        resetCardUI();
        showSuccess('تم تسجيل الحضور بنجاح ✅');

    } catch (err) {
        showError(err.message || 'حدث خطأ أثناء تنفيذ العملية.');
        scanLocked = false;
        scanner?.resume();
    } finally {
        actionInProgress = false;
    }
}

// 10. مسح الحضور لبدء يوم جديد
async function clearAttendance() {
    if (!window.confirm('هل تريد مسح كل سجلات الحضور؟ لن تتأثر بيانات الطلاب أو حالات الدفع.')) return;

    clearAttendanceBtn.disabled = true;

    try {
        const { error } = await db
            .from('attendance')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) throw error;

        resetCardUI();
        showSuccess('تم مسح سجل الحضور وبدء يوم جديد بنجاح');
    } catch (err) {
        showError(err.message);
    } finally {
        clearAttendanceBtn.disabled = false;
    }
}

// 11. إعادة إتاحة الكاميرا وإعادة تعيين الواجهة
function resetCardUI() {
    studentInfo.classList.add('hidden');
    currentStudent = null;
    scanLocked = false;
    studentIdInput.value = '';
    studentIdInput.focus();

    try {
        scanner?.resume();
    } catch (e) {}
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.className = 'error-message';
    errorMessage.classList.remove('hidden');
}

function showSuccess(message) {
    errorText.textContent = message;
    errorMessage.className = 'error-message success-style';
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
