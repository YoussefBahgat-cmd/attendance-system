// 1. بيانات الاتصال بقاعدة بيانات Supabase
const SUPABASE_URL = "https://nfegjcgffqhoanhunrha.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_P4BWclFrOfZFbM8UegQWwQ_cJc4Z6da";

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
const studentAvatar = document.getElementById('studentAvatar');
const statusBadge = document.getElementById('statusBadge');
const payAndAttendBtn = document.getElementById('payAndAttendBtn');
const attendanceOnlyBtn = document.getElementById('attendanceOnlyBtn');
const paymentStatusText = document.getElementById('paymentStatusText');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const clearAttendanceBtn = document.getElementById('clearAttendanceBtn');

// 3. تشغيل الصوت (تنبيه عند المسح)
function playBeepSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // تردد الصوت 800Hz
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15); // مدة الصوت 150 ملي ثانية
    } catch (e) {
        console.log('صوت التنبيه غير مدعوم أو يتطلب تفاعل مع الصفحة أولاً');
    }
}

// 4. تهيئة الأحداث عند التحميل
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

// 5. تشغيل ماسح الـ QR Code وإغلاقه فور القراءة
function startScanner() {
    scanner = new Html5Qrcode('qrReader');
    scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decodedText => {
            if (scanLocked || searchInProgress) return;

            scanLocked = true; // إغلاق المسح لمنع التكرار
            playBeepSound(); // تشغيل صوت التنبيه

            // إيقاف الـ Scanner المؤقت فور القراءة
            scanner.pause(true);

            studentIdInput.value = decodedText.trim();
            searchStudent();
        },
        () => {}
    ).catch(() => showError('اسمح للمتصفح باستخدام الكاميرا لعمل Scan'));
}

// 6. البحث عن الطالب في Supabase
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

        if (studentError || !student) {
            showError('الطالب غير موجود في قاعدة البيانات!');
            resetCardUI();
            return;
        }

        const { data: payment } = await db
            .from('payments')
            .select('*')
            .eq('student_id', student.id)
            .eq('payment_month', '2026-09-01')
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
        showError('حدث خطأ أثناء الاتصال بقاعدة البيانات.');
        resetCardUI();
    } finally {
        searchInProgress = false;
    }
}

// 7. عرض بيانات الطالب
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

// 8. تنفيذ عمليات الدفع والحضور
async function completeAction(action) {
    if (!currentStudent || actionInProgress) return;

    actionInProgress = true;
    payAndAttendBtn.disabled = true;
    attendanceOnlyBtn.disabled = true;

    try {
        let paymentStatus = currentStudent.status;

        if (action === 'payAndRecordAttendance') {
            const { error: payError } = await db
                .from('payments')
                .upsert({
                    student_id: currentStudent.id,
                    payment_month: '2026-09-01',
                    status: 'مدفوع',
                    paid_at: new Date().toISOString()
                }, { onConflict: 'student_id, payment_month' });

            if (payError) throw new Error('فشل تحديث حالة الدفع');
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
                throw new Error('فشل تسجيل الحضور');
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

// 9. مسح الحضور لبدء يوم جديد
async function clearAttendance() {
    if (!window.confirm('هل تريد مسح كل سجلات الحضور؟ لن تتأثر بيانات الطلاب أو حالات الدفع.')) return;

    clearAttendanceBtn.disabled = true;

    try {
        const { error } = await db
            .from('attendance')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) throw new Error('فشل مسح سجل الحضور');

        resetCardUI();
        showSuccess('تم مسح سجل الحضور وبدء يوم جديد بنجاح');
    } catch (err) {
        showError(err.message);
    } finally {
        clearAttendanceBtn.disabled = false;
    }
}

// 10. إعادة استئناف الـ Scan وإخفاء كارت الطالب
function resetCardUI() {
    studentInfo.classList.add('hidden');
    currentStudent = null;
    scanLocked = false;
    studentIdInput.value = '';
    studentIdInput.focus();

    // إعادة تشغيل الكاميرا لاستقبال الطالب التالي
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