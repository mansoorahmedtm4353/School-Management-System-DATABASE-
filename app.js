/**
 * IMSciences School Management System Database Core & UI Controller
 */

// Initialize Database Object
const DB = {
    // Initialize database schema and UDFs
    createSchema() {
        // Reset database context completely
        alasql('DROP DATABASE IF EXISTS school_db');
        alasql('CREATE DATABASE school_db');
        alasql('USE school_db');

        // CREATE TABLES

        // 1. Instructor
        alasql(`CREATE TABLE Instructor (
            instructor_id STRING PRIMARY KEY,
            first_name STRING,
            last_name STRING,
            email STRING,
            phone STRING
        )`);

        // 2. Department
        alasql(`CREATE TABLE Department (
            deptno INT PRIMARY KEY,
            deptname STRING,
            hod STRING
        )`);

        // 3. Student
        alasql(`CREATE TABLE Student (
            student_id STRING PRIMARY KEY,
            first_name STRING,
            last_name STRING,
            cnic STRING,
            gender STRING,
            dob STRING,
            address STRING,
            phone STRING,
            deptno INT
        )`);

        // 4. Graduate Student (Subtype)
        alasql(`CREATE TABLE Graduate_Student (
            student_id STRING PRIMARY KEY,
            thesis_advisor STRING,
            thesis_status STRING
        )`);

        // 5. Undergraduate Student (Subtype)
        alasql(`CREATE TABLE Undergraduate_Student (
            student_id STRING PRIMARY KEY,
            fyp_advisor STRING
        )`);

        // 6. Room
        alasql(`CREATE TABLE Room (
            roomno INT PRIMARY KEY,
            capacity INT
        )`);

        // 7. Course
        alasql(`CREATE TABLE Course (
            course_code STRING PRIMARY KEY,
            course_title STRING,
            credit_hours NUMBER
        )`);

        // 8. Pre-Requisite Course (no composite PK constraint in CREATE statement to avoid syntax errors)
        alasql(`CREATE TABLE Pre_Requisite_Course (
            course_code STRING,
            pre_req STRING
        )`);

        // 9. Lecture Class
        alasql(`CREATE TABLE Lecture_Class (
            instructor_id STRING,
            course_code STRING,
            room_no INT
        )`);

        // 10. Enrollment (no composite PK constraint)
        alasql(`CREATE TABLE Enrollment (
            student_id STRING,
            course_code STRING,
            enrollment_date STRING,
            grade STRING,
            status STRING
        )`);

        // Register Custom SQL Functions
        this.registerFunctions();

        // CREATE VIEWS
        this.createViews();
    },

    // Check if database is empty and initialize it
    init() {
        try {
            this.createSchema();

            // Populate Default Mock Data
            this.populateMockData();

            this.saveToStorage();
            console.log("Database initialized successfully!");
        } catch (err) {
            console.error("Database initialization failed:", err);
            UI.showToast("Database Error", "Failed to initialize SQL database. " + err.message, "danger");
        }
    },

    // Save current tables state to localStorage
    saveToStorage() {
        try {
            const state = {
                Instructor: alasql('SELECT * FROM Instructor'),
                Department: alasql('SELECT * FROM Department'),
                Student: alasql('SELECT * FROM Student'),
                Graduate_Student: alasql('SELECT * FROM Graduate_Student'),
                Undergraduate_Student: alasql('SELECT * FROM Undergraduate_Student'),
                Room: alasql('SELECT * FROM Room'),
                Course: alasql('SELECT * FROM Course'),
                Pre_Requisite_Course: alasql('SELECT * FROM Pre_Requisite_Course'),
                Lecture_Class: alasql('SELECT * FROM Lecture_Class'),
                Enrollment: alasql('SELECT * FROM Enrollment')
            };
            localStorage.setItem('IMSciences_SMS_DB', JSON.stringify(state));
        } catch (e) {
            console.error("Failed to save state to storage:", e);
        }
    },

    // Load tables state from localStorage
    loadFromStorage() {
        try {
            const raw = localStorage.getItem('IMSciences_SMS_DB');
            if (!raw) {
                this.init();
                return;
            }
            const state = JSON.parse(raw);
            
            this.createSchema();

            // Repopulate from saved state
            for (let table in state) {
                if (state[table] && state[table].length > 0) {
                    state[table].forEach(row => {
                        const keys = Object.keys(row);
                        const placeholders = keys.map(() => '?').join(',');
                        const values = keys.map(k => row[k]);
                        alasql(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`, values);
                    });
                }
            }
            console.log("Database state loaded from LocalStorage.");
        } catch (e) {
            console.error("Error loading DB from storage, fallback to default init:", e);
            this.init();
        }
    },

    // Create Relational Views
    createViews() {
        // View 1: Student Details
        alasql(`CREATE VIEW student_details AS
            SELECT 
                S.student_id,
                (S.first_name + ' ' + S.last_name) AS full_name,
                S.cnic,
                S.gender,
                S.dob,
                S.address,
                S.phone,
                D.deptname AS department_name,
                (H.first_name + ' ' + H.last_name) AS department_head
            FROM Student S
            LEFT JOIN Department D ON S.deptno = D.deptno
            LEFT JOIN Instructor H ON D.hod = H.instructor_id`);

        // View 2: Enrollment Details
        alasql(`CREATE VIEW Enrollment_Details AS
            SELECT
                e.student_id,
                s.first_name,
                s.last_name,
                e.course_code,
                c.course_title,
                e.enrollment_date,
                e.grade,
                e.status
            FROM Enrollment e
            JOIN Student s ON e.student_id = s.student_id
            JOIN Course c ON e.course_code = c.course_code`);

        // View 3: Graduate Students Details
        alasql(`CREATE VIEW Graduate_Student_Details AS
            SELECT 
                gs.student_id,
                (s.first_name + ' ' + s.last_name) AS student_name,
                s.cnic,
                s.gender,
                s.dob,
                s.address,
                s.phone,
                (i.first_name + ' ' + i.last_name) AS advisor_name,
                gs.thesis_status
            FROM Graduate_Student gs
            JOIN Student s ON gs.student_id = s.student_id
            JOIN Instructor i ON gs.thesis_advisor = i.instructor_id`);

        // View 4: Pre-Requisite Courses Details
        alasql(`CREATE VIEW Pre_Requisite_Course_Details AS
            SELECT
                c.course_title AS course_title,
                prc2.course_title AS pre_req_title
            FROM Pre_Requisite_Course prc
            JOIN Course c ON prc.course_code = c.course_code
            JOIN Course prc2 ON prc.pre_req = prc2.course_code`);
    },

    // Register SQL User Defined Functions for Reports and Queries
    registerFunctions() {
        // Function 1: GetAVGGradePoint(course_code)
        alasql.fn.GetAVGGradePoint = function(courseCode) {
            const res = alasql('SELECT grade FROM Enrollment WHERE course_code = ?', [courseCode]);
            if (!res || res.length === 0) return null;
            let total = 0;
            let count = 0;
            res.forEach(row => {
                let gp = null;
                switch (row.grade) {
                    case 'A': gp = 4.0; break;
                    case 'B': gp = 3.0; break;
                    case 'C': gp = 2.0; break;
                    case 'D': gp = 1.0; break;
                    case 'F': gp = 0.0; break;
                }
                if (gp !== null) {
                    total += gp;
                    count++;
                }
            });
            return count > 0 ? (total / count).toFixed(2) : "N/A";
        };

        // Function 2: GetClassCountForTeacher(instructor_id)
        alasql.fn.GetClassCountForTeacher = function(instructorId) {
            const res = alasql('SELECT COUNT(*) AS cnt FROM Lecture_Class WHERE instructor_id = ?', [instructorId]);
            return res[0] ? res[0].cnt : 0;
        };

        // Function 3: GetTotalGraduateStudentsInDept(deptno)
        alasql.fn.GetTotalGraduateStudentsInDept = function(deptNo) {
            const res = alasql('SELECT COUNT(*) AS cnt FROM Graduate_Student gs JOIN Student s ON gs.student_id = s.student_id WHERE s.deptno = ?', [parseInt(deptNo)]);
            return res[0] ? res[0].cnt : 0;
        };
    },

    // Insert Default Mock Data
    populateMockData() {
        // Instructors
        alasql("INSERT INTO Instructor VALUES ('I-00000001', 'Mansoor', 'Khan', 'mansoor.khan@ims.edu', '923331112222')");
        alasql("INSERT INTO Instructor VALUES ('I-00000002', 'Sarah', 'Ahmad', 'sarah.ahmad@ims.edu', '923331112223')");
        alasql("INSERT INTO Instructor VALUES ('I-00000003', 'Asim', 'Shah', 'asim.shah@ims.edu', '923331112224')");
        alasql("INSERT INTO Instructor VALUES ('I-00000004', 'Noreen', 'Bibi', 'noreen.bibi@ims.edu', '923331112225')");

        // Departments
        alasql("INSERT INTO Department VALUES (10, 'Management Sciences', 'I-00000001')");
        alasql("INSERT INTO Department VALUES (20, 'Computer Science', 'I-00000002')");
        alasql("INSERT INTO Department VALUES (30, 'Business Administration', 'I-00000003')");

        // Students
        alasql("INSERT INTO Student VALUES ('S-00000001', 'Ali', 'Khan', '1730123456789', 'M', '2005-04-12', 'Hayatabad, Peshawar', '923330001111', 20)");
        alasql("INSERT INTO Student VALUES ('S-00000002', 'Fatima', 'Bibi', '1730123456788', 'F', '2004-09-22', 'Saddar, Peshawar', '923330002222', 20)");
        alasql("INSERT INTO Student VALUES ('S-00000003', 'Usman', 'Shah', '1730123456787', 'M', '2002-11-05', 'Kabal, Swat', '923330003333', 20)");
        alasql("INSERT INTO Student VALUES ('S-00000004', 'Zara', 'Gul', '1730123456786', 'F', '2001-01-30', 'University Rd, Peshawar', '923330004444', 10)");
        alasql("INSERT INTO Student VALUES ('S-00000005', 'Faisal', 'Amin', '1730123456785', 'M', '2005-08-15', 'Phase 6, Hayatabad', '923330005555', 30)");

        // Graduate Students
        alasql("INSERT INTO Graduate_Student VALUES ('S-00000003', 'I-00000001', 'COMPLETE')");
        alasql("INSERT INTO Graduate_Student VALUES ('S-00000004', 'I-00000003', 'IN PROGRESS')");

        // Undergraduate Students
        alasql("INSERT INTO Undergraduate_Student VALUES ('S-00000001', 'I-00000002')");
        alasql("INSERT INTO Undergraduate_Student VALUES ('S-00000002', 'I-00000002')");
        alasql("INSERT INTO Undergraduate_Student VALUES ('S-00000005', 'I-00000004')");

        // Rooms
        alasql("INSERT INTO Room VALUES (101, 30)");
        alasql("INSERT INTO Room VALUES (102, 25)");
        alasql("INSERT INTO Room VALUES (201, 40)");
        alasql("INSERT INTO Room VALUES (202, 15)"); // Empty room for report 2

        // Courses
        alasql("INSERT INTO Course VALUES ('CS-101', 'Introduction to Database', 3)");
        alasql("INSERT INTO Course VALUES ('CS-201', 'Advanced Database Systems', 3)");
        alasql("INSERT INTO Course VALUES ('CS-301', 'Machine Learning', 3)");
        alasql("INSERT INTO Course VALUES ('MS-101', 'Principles of Management', 3)");

        // Prerequisites
        alasql("INSERT INTO Pre_Requisite_Course VALUES ('CS-201', 'CS-101')");

        // Classes
        alasql("INSERT INTO Lecture_Class VALUES ('I-00000002', 'CS-101', 101)");
        alasql("INSERT INTO Lecture_Class VALUES ('I-00000001', 'CS-201', 201)");
        alasql("INSERT INTO Lecture_Class VALUES ('I-00000003', 'MS-101', 102)");

        // Enrollments
        // S-01 passed CS-101 (intro)
        alasql("INSERT INTO Enrollment VALUES ('S-00000001', 'CS-101', '2025-09-10', 'B', 'PASS')");
        // S-02 failed CS-101
        alasql("INSERT INTO Enrollment VALUES ('S-00000002', 'CS-101', '2025-09-10', 'F', 'FAIL')");
        // S-03 passed CS-101 and CS-201
        alasql("INSERT INTO Enrollment VALUES ('S-00000003', 'CS-101', '2025-02-15', 'A', 'PASS')");
        alasql("INSERT INTO Enrollment VALUES ('S-00000003', 'CS-201', '2025-09-10', 'B', 'PASS')");
        // S-05 enrolled in MS-101, no grade yet
        alasql("INSERT INTO Enrollment VALUES ('S-00000005', 'MS-101', '2026-03-01', NULL, NULL)");
    },

    // PROCEDURES SIMULATED VIA JAVASCRIPT ENDPOINTS WITH SQL EXECUTIONS
    
    // Procedure 1: Student_Result(student_id)
    procedureStudentResult(studentId, logCallback) {
        logCallback(`CALL Student_Result('${studentId}');\n`);
        logCallback(`DBMS_OUTPUT: Beginning execution for Student ID: ${studentId}`);
        logCallback(`DBMS_OUTPUT: ----------------------------------------------------`);

        const enrollments = alasql(`
            SELECT e.course_code, c.course_title, e.grade, e.status
            FROM Enrollment e
            JOIN Course c ON e.course_code = c.course_code
            WHERE e.student_id = ?
        `, [studentId]);

        if (!enrollments || enrollments.length === 0) {
            logCallback(`DBMS_OUTPUT: No enrollments found for the given Student ID.`);
            return false;
        }

        enrollments.forEach(rec => {
            logCallback(`DBMS_OUTPUT: Course Code:  ${rec.course_code}`);
            logCallback(`DBMS_OUTPUT: Course Title: ${rec.course_title}`);
            logCallback(`DBMS_OUTPUT: Grade:        ${rec.grade || 'N/A'}`);
            logCallback(`DBMS_OUTPUT: Status:       ${rec.status || 'ENROLLED'}`);
            logCallback(`DBMS_OUTPUT: ---------------------------------------------`);
        });

        logCallback(`DBMS_OUTPUT: Procedure completed successfully.`);
        return enrollments;
    },

    // Procedure 2: InsertStudent(...)
    procedureInsertStudent(data) {
        // Validations (UNIQUE checks)
        const checkId = alasql('SELECT student_id FROM Student WHERE student_id = ?', [data.student_id]);
        if (checkId.length > 0) throw new Error(`Primary Key violation: Student ID '${data.student_id}' already exists.`);

        const checkCnic = alasql('SELECT cnic FROM Student WHERE cnic = ?', [data.cnic]);
        if (checkCnic.length > 0) throw new Error(`Unique constraint violation: CNIC '${data.cnic}' is already registered.`);

        const checkPhone = alasql('SELECT phone FROM Student WHERE phone = ?', [data.phone]);
        if (checkPhone.length > 0) throw new Error(`Unique constraint violation: Phone number '${data.phone}' is already registered.`);

        // Insert into base Student Table
        alasql(`INSERT INTO Student (student_id, first_name, last_name, cnic, gender, dob, address, phone, deptno)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [data.student_id, data.first_name, data.last_name, data.cnic, data.gender, data.dob, data.address, data.phone, parseInt(data.deptno)]
        );

        // Subtype insertion
        if (data.subtype === 'GRADUATE') {
            alasql('INSERT INTO Graduate_Student VALUES (?, ?, ?)', [data.student_id, data.thesis_advisor, data.thesis_status]);
        } else {
            alasql('INSERT INTO Undergraduate_Student VALUES (?, ?)', [data.student_id, data.fyp_advisor]);
        }

        this.saveToStorage();
        return true;
    },

    // Procedure 3: InsertGrade(student_id, course_code, marks)
    procedureInsertGrade(studentId, courseCode, marks) {
        // Enforce trigger checks first
        this.triggerCheckPrerequisites(studentId, courseCode);
        this.triggerCheckEnrollmentLimit(courseCode, studentId);

        let grade = '';
        let status = '';

        if (marks !== null && marks !== undefined && marks !== '') {
            const numericMarks = parseFloat(marks);
            if (numericMarks > 85) {
                grade = 'A';
                status = 'PASS';
            } else if (numericMarks > 75) {
                grade = 'B';
                status = 'PASS';
            } else if (numericMarks > 65) {
                grade = 'C';
                status = 'PASS';
            } else if (numericMarks > 50) {
                grade = 'D';
                status = 'PASS';
            } else {
                grade = 'F';
                status = 'FAIL';
            }
        } else {
            grade = null;
            status = null;
        }

        const date = new Date().toISOString().split('T')[0];

        // Check if enrollment already exists
        const exists = alasql('SELECT * FROM Enrollment WHERE student_id = ? AND course_code = ?', [studentId, courseCode]);
        if (exists.length > 0) {
            alasql('UPDATE Enrollment SET grade = ?, status = ? WHERE student_id = ? AND course_code = ?', 
                [grade, status, studentId, courseCode]
            );
        } else {
            alasql('INSERT INTO Enrollment VALUES (?, ?, ?, ?, ?)', [studentId, courseCode, date, grade, status]);
        }

        this.saveToStorage();
        return { grade, status };
    },

    // TRIGGERS SIMULATION (Run before updates/inserts)
    
    // Trigger 1: CheckCourseEnrollmentLimit (BEFORE INSERT)
    triggerCheckEnrollmentLimit(courseCode, studentId) {
        // If already enrolled, this is an update grade, so skip limit check
        const enrolled = alasql('SELECT 1 FROM Enrollment WHERE student_id = ? AND course_code = ?', [studentId, courseCode]);
        if (enrolled.length > 0) return;

        const countRes = alasql('SELECT COUNT(*) AS cnt FROM Enrollment WHERE course_code = ?', [courseCode]);
        const currentCount = countRes[0] ? countRes[0].cnt : 0;
        
        if (currentCount >= 20) {
            throw new Error(`Trigger trg_CheckCourseEnrollmentLimit: Enrollment limit exceeded for this course (${courseCode}). No more than 20 students can be enrolled.`);
        }
    },

    // Trigger 2: EnforcePrereqCompletion (BEFORE INSERT)
    triggerCheckPrerequisites(studentId, courseCode) {
        // Query if course has prerequisites
        const prereqs = alasql('SELECT pre_req FROM Pre_Requisite_Course WHERE course_code = ?', [courseCode]);
        if (!prereqs || prereqs.length === 0) return; // No prerequisite

        // Verify if student has passed all prerequisites
        for (let i = 0; i < prereqs.length; i++) {
            const pCode = prereqs[i].pre_req;
            const passed = alasql(`
                SELECT 1 FROM Enrollment 
                WHERE student_id = ? AND course_code = ? AND status = 'PASS'
            `, [studentId, pCode]);

            if (!passed || passed.length === 0) {
                const cTitleRes = alasql('SELECT course_title FROM Course WHERE course_code = ?', [pCode]);
                const cTitle = cTitleRes[0] ? cTitleRes[0].course_title : pCode;
                throw new Error(`Trigger trg_EnforcePrereqCompletion: Prerequisite course not completed. Student must first complete and PASS '${pCode} (${cTitle})'.`);
            }
        }
    }
};

// UI & Router Controller
const UI = {
    activeTab: 'dashboard',

    init() {
        this.bindEvents();
        this.loadState();
        this.renderAll();
    },

    bindEvents() {
        // Sidebar navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });

        // Tab views navigation
        document.querySelectorAll('.view-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.view-nav-item').forEach(btn => btn.classList.remove('active'));
                item.classList.add('active');
                this.renderViewTab(item.getAttribute('data-view'));
            });
        });

        // Procedure: Student_Result Lookup
        document.getElementById('run-procedure-result-btn').addEventListener('click', () => {
            const stdId = document.getElementById('procedure-student-select').value;
            if (!stdId) return;
            const logBox = document.getElementById('procedure-output-logs');
            logBox.textContent = '';
            
            DB.procedureStudentResult(stdId, (log) => {
                logBox.textContent += log + '\n';
            });
        });

        // Reset database button
        document.getElementById('reset-db-btn').addEventListener('click', () => {
            if (confirm("Are you sure you want to reset the database? This will clear all changes and restore default mock data.")) {
                localStorage.removeItem('IMSciences_SMS_DB');
                DB.init();
                this.renderAll();
                this.showToast("Database Reset", "The database has been restored to default state.", "info");
            }
        });

        // Add Student Modal controls
        const studentModal = document.getElementById('add-student-modal');
        document.getElementById('add-student-modal-btn').addEventListener('click', () => {
            this.populateModalDropdowns();
            studentModal.classList.add('active');
        });

        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                studentModal.classList.remove('active');
                document.getElementById('generic-modal').classList.remove('active');
            });
        });

        // Subtype toggle fields in student form
        document.querySelectorAll('input[name="std-subtype"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'GRADUATE') {
                    document.getElementById('grad-fields').classList.remove('d-none');
                    document.getElementById('undergrad-fields').classList.add('d-none');
                    document.getElementById('std-thesis-advisor').setAttribute('required', 'true');
                    document.getElementById('std-fyp-advisor').removeAttribute('required');
                } else {
                    document.getElementById('grad-fields').classList.add('d-none');
                    document.getElementById('undergrad-fields').classList.remove('d-none');
                    document.getElementById('std-fyp-advisor').setAttribute('required', 'true');
                    document.getElementById('std-thesis-advisor').removeAttribute('required');
                }
            });
        });

        // Form Submit: Add Student (Simulate procedure)
        document.getElementById('add-student-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                student_id: document.getElementById('std-id').value.trim(),
                first_name: document.getElementById('std-firstname').value.trim(),
                last_name: document.getElementById('std-lastname').value.trim(),
                cnic: document.getElementById('std-cnic').value.trim(),
                gender: document.getElementById('std-gender').value,
                dob: document.getElementById('std-dob').value,
                address: document.getElementById('std-address').value.trim(),
                phone: document.getElementById('std-phone').value.trim(),
                deptno: document.getElementById('std-dept').value,
                subtype: document.querySelector('input[name="std-subtype"]:checked').value,
                fyp_advisor: document.getElementById('std-fyp-advisor').value,
                thesis_advisor: document.getElementById('std-thesis-advisor').value,
                thesis_status: document.getElementById('std-thesis-status').value
            };

            try {
                DB.procedureInsertStudent(data);
                this.showToast("Registration Success", `Student ${data.first_name} ${data.last_name} has been successfully registered.`, "success");
                studentModal.classList.remove('active');
                document.getElementById('add-student-form').reset();
                this.renderAll();
            } catch (err) {
                this.showToast("Validation Constraint Fail", err.message, "danger");
            }
        });

        // Form Submit: Enroll Student / Insert Grade
        document.getElementById('enrollment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const sId = document.getElementById('enroll-student-select').value;
            const cCode = document.getElementById('enroll-course-select').value;
            const marksVal = document.getElementById('enroll-marks').value;
            
            try {
                const res = DB.procedureInsertGrade(sId, cCode, marksVal);
                if (marksVal) {
                    this.showToast("Grade Computed", `Marks updated. Computed Grade: ${res.grade} (Status: ${res.status})`, "success");
                } else {
                    this.showToast("Enrollment Success", `Student successfully registered in course ${cCode}.`, "success");
                }
                document.getElementById('enrollment-form').reset();
                this.renderAll();
            } catch (err) {
                this.showToast("Trigger Blocked Transaction", err.message, "danger");
            }
        });

        // Filter / Search Students
        document.getElementById('student-search-input').addEventListener('input', () => this.renderStudentsList());
        document.getElementById('student-filter-type').addEventListener('change', () => this.renderStudentsList());
        document.getElementById('student-filter-dept').addEventListener('change', () => this.renderStudentsList());

        // Run Reports triggers
        document.querySelectorAll('.run-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reportNum = btn.getAttribute('data-report');
                this.runReport(reportNum);
            });
        });

        // SQL Console Execution
        document.getElementById('console-run-btn').addEventListener('click', () => this.executeConsoleSQL());
        document.getElementById('console-preset-btn').addEventListener('click', () => {
            const presets = [
                "SELECT * FROM Student_Details WHERE gender = 'F';",
                "SELECT course_code, course_title, GetAVGGradePoint(course_code) AS Average_GPA FROM Course;",
                "SELECT instructor_id, email, GetClassCountForTeacher(instructor_id) AS Taught_Classes FROM Instructor;",
                "SELECT deptno, deptname, GetTotalGraduateStudentsInDept(deptno) AS Grad_Students_Count FROM Department;",
                "SELECT * FROM Enrollment WHERE grade IS NULL;"
            ];
            const idx = Math.floor(Math.random() * presets.length);
            document.getElementById('sql-console-input').value = presets[idx];
        });
        document.getElementById('console-clear-btn').addEventListener('click', () => {
            document.getElementById('sql-console-input').value = '';
            document.getElementById('console-output-container').classList.add('d-none');
            document.getElementById('console-error-container').classList.add('d-none');
        });

        // Ctrl + Enter shortcut in console textarea
        document.getElementById('sql-console-input').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.executeConsoleSQL();
            }
        });

        // MySQL Console run
        document.getElementById('mysql-console-run-btn').addEventListener('click', () => this.executeMySQLConsoleSQL());
        
        // MySQL Export script copy
        document.getElementById('copy-mysql-script-btn').addEventListener('click', () => {
            const codeText = document.getElementById('mysql-export-code').textContent;
            navigator.clipboard.writeText(codeText).then(() => {
                this.showToast("Copied", "MySQL export script copied to clipboard!", "success");
            }).catch(err => {
                this.showToast("Copy Failed", "Please select and copy manually.", "warning");
            });
        });

        // Ctrl + Enter shortcut in mysql console textarea
        document.getElementById('mysql-console-input').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.executeMySQLConsoleSQL();
            }
        });

        // Setup generic modal triggers for Rooms/Courses/Classes/Instructors/Depts
        document.getElementById('add-course-btn').addEventListener('click', () => this.showGenericAddModal('course'));
        document.getElementById('add-class-btn').addEventListener('click', () => this.showGenericAddModal('class'));
        document.getElementById('add-instructor-btn').addEventListener('click', () => this.showGenericAddModal('instructor'));
        document.getElementById('add-dept-btn').addEventListener('click', () => this.showGenericAddModal('dept'));
        document.getElementById('add-room-btn').addEventListener('click', () => this.showGenericAddModal('room'));
    },

    switchTab(tabId) {
        document.querySelectorAll('.menu-item').forEach(item => {
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        const targetPane = document.getElementById('tab-' + tabId);
        if (targetPane) {
            targetPane.classList.add('active');
        }

        // Set Header Title & Subtitle
        const titles = {
            dashboard: { title: "Dashboard Overview", sub: "Academic session 2024 - 2028" },
            students: { title: "Student Records Directory", sub: "Search and register students" },
            enrollments: { title: "Course Enrollments & Grades", sub: "Manage grade sheets and enforce triggers" },
            courses: { title: "Academic Courses & Classes", sub: "Manage curricula, prerequisites and schedules" },
            staff: { title: "Staff & Infrastructure", sub: "Instructors, university departments and lecture rooms" },
            views: { title: "Relational Schema Views", sub: "Explore virtual views registered in DB engine" },
            reports: { title: "Institutional Analysis Reports", sub: "Execute required procedural reports" },
            console: { title: "SQL Terminal Console", sub: "Execute custom raw SELECT and structural DDL statements" },
            mysql: { title: "MySQL Play & Export Terminal", sub: "Execute MySQL syntax queries and export production scripts" }
        };

        if (titles[tabId]) {
            document.getElementById('page-title').textContent = titles[tabId].title;
            document.getElementById('page-subtitle').textContent = titles[tabId].sub;
        }

        this.activeTab = tabId;
        this.renderAll();
    },

    loadState() {
        DB.loadFromStorage();
    },

    renderAll() {
        this.renderDashboardStats();
        this.renderStudentsList();
        this.renderEnrollmentsList();
        this.renderCoursesAndClasses();
        this.renderStaffAndRooms();
        this.populateFormsDropdowns();
        
        // Auto render first view when inside Views tab
        if (this.activeTab === 'views') {
            const activeView = document.querySelector('.view-nav-item.active').getAttribute('data-view');
            this.renderViewTab(activeView);
        }

        if (this.activeTab === 'mysql') {
            this.renderMySQLExportCode();
        }
    },

    renderDashboardStats() {
        try {
            const totalStudents = alasql('SELECT COUNT(*) AS cnt FROM Student')[0].cnt;
            const totalInstructors = alasql('SELECT COUNT(*) AS cnt FROM Instructor')[0].cnt;
            const totalCourses = alasql('SELECT COUNT(*) AS cnt FROM Course')[0].cnt;
            const totalRooms = alasql('SELECT COUNT(*) AS cnt FROM Room')[0].cnt;

            document.getElementById('stat-total-students').textContent = totalStudents;
            document.getElementById('stat-total-instructors').textContent = totalInstructors;
            document.getElementById('stat-total-courses').textContent = totalCourses;
            document.getElementById('stat-total-rooms').textContent = totalRooms;

            // Free Rooms count
            const freeRoomsRes = alasql(`
                SELECT COUNT(*) AS cnt FROM Room R
                LEFT JOIN Lecture_Class C ON R.roomno = C.room_no
                WHERE C.room_no IS NULL
            `);
            const freeRooms = freeRoomsRes[0] ? freeRoomsRes[0].cnt : 0;
            document.getElementById('stat-free-rooms-count').textContent = `${freeRooms} Free yet`;

            // Render mini HOD list
            const depts = alasql(`
                SELECT D.deptno, D.deptname, I.first_name, I.last_name
                FROM Department D
                JOIN Instructor I ON D.hod = I.instructor_id
            `);
            const container = document.getElementById('dashboard-dept-list');
            container.innerHTML = '';
            depts.forEach(dept => {
                const count = alasql.fn.GetTotalGraduateStudentsInDept(dept.deptno);
                container.innerHTML += `
                    <div class="dept-mini-card">
                        <div class="dept-mini-info">
                            <h4>${dept.deptname}</h4>
                            <span>HOD: ${dept.first_name} ${dept.last_name}</span>
                        </div>
                        <span class="badge badge-indigo">${count} Grad Students</span>
                    </div>
                `;
            });
        } catch (e) {
            console.error("Error loading stats:", e);
        }
    },

    renderStudentsList() {
        const tbody = document.querySelector('#students-table tbody');
        if (!tbody) return;

        const queryStr = document.getElementById('student-search-input').value.toLowerCase().trim();
        const typeFilter = document.getElementById('student-filter-type').value;
        const deptFilter = document.getElementById('student-filter-dept').value;

        // Fetch students along with subtype advisor info
        let students = alasql(`
            SELECT S.*, D.deptname
            FROM Student S
            LEFT JOIN Department D ON S.deptno = D.deptno
        `);

        // Apply filters
        students = students.filter(std => {
            const matchesQuery = std.student_id.toLowerCase().includes(queryStr) || 
                                (std.first_name + ' ' + std.last_name).toLowerCase().includes(queryStr) ||
                                std.cnic.includes(queryStr);
            
            let matchesType = true;
            const isGrad = alasql('SELECT 1 FROM Graduate_Student WHERE student_id = ?', [std.student_id]).length > 0;
            if (typeFilter === 'GRADUATE') matchesType = isGrad;
            else if (typeFilter === 'UNDERGRADUATE') matchesType = !isGrad;

            const matchesDept = deptFilter === 'ALL' || std.deptno.toString() === deptFilter;

            return matchesQuery && matchesType && matchesDept;
        });

        tbody.innerHTML = '';
        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-muted text-center">No students match filter criteria.</td></tr>`;
            return;
        }

        students.forEach(std => {
            const gradRow = alasql('SELECT * FROM Graduate_Student WHERE student_id = ?', [std.student_id])[0];
            const undergradRow = alasql('SELECT * FROM Undergraduate_Student WHERE student_id = ?', [std.student_id])[0];
            
            let typeLabel = '';
            let advisorName = '';
            
            if (gradRow) {
                typeLabel = `<span class="badge badge-indigo">Graduate</span>`;
                const adv = alasql('SELECT first_name, last_name FROM Instructor WHERE instructor_id = ?', [gradRow.thesis_advisor])[0];
                advisorName = adv ? `Adv: Dr. ${adv.last_name} (${gradRow.thesis_status})` : 'N/A';
            } else if (undergradRow) {
                typeLabel = `<span class="badge badge-teal">Undergraduate</span>`;
                const adv = alasql('SELECT first_name, last_name FROM Instructor WHERE instructor_id = ?', [undergradRow.fyp_advisor])[0];
                advisorName = adv ? `FYP: Prof. ${adv.last_name}` : 'N/A';
            }

            tbody.innerHTML += `
                <tr>
                    <td><code>${std.student_id}</code></td>
                    <td><strong>${std.first_name} ${std.last_name}</strong></td>
                    <td><code>${std.cnic}</code></td>
                    <td>${std.gender}</td>
                    <td>${std.dob || 'N/A'}</td>
                    <td>${std.deptname || 'N/A'}</td>
                    <td>${typeLabel}</td>
                    <td class="text-sm">${advisorName}</td>
                    <td>
                        <button class="btn-icon text-danger" onclick="UI.deleteStudent('${std.student_id}')" title="Delete Student Record">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    },

    deleteStudent(id) {
        if (confirm(`Are you sure you want to delete student ${id}? This deletes the student and their enrollments due to relational integrity constraints.`)) {
            try {
                alasql('DELETE FROM Graduate_Student WHERE student_id = ?', [id]);
                alasql('DELETE FROM Undergraduate_Student WHERE student_id = ?', [id]);
                alasql('DELETE FROM Enrollment WHERE student_id = ?', [id]);
                alasql('DELETE FROM Student WHERE student_id = ?', [id]);
                DB.saveToStorage();
                this.renderAll();
                this.showToast("Student Removed", `Student ${id} has been deleted.`, "info");
            } catch (e) {
                this.showToast("Error", e.message, "danger");
            }
        }
    },

    renderEnrollmentsList() {
        const tbody = document.querySelector('#enrollments-table tbody');
        if (!tbody) return;

        const enrollments = alasql(`
            SELECT E.*, S.first_name, S.last_name, C.course_title
            FROM Enrollment E
            JOIN Student S ON E.student_id = S.student_id
            JOIN Course C ON E.course_code = C.course_code
        `);

        tbody.innerHTML = '';
        if (enrollments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-muted text-center">No active course enrollments registered.</td></tr>`;
            return;
        }

        enrollments.forEach(enr => {
            let statusBadge = '';
            if (enr.status === 'PASS') statusBadge = `<span class="badge badge-success">PASS</span>`;
            else if (enr.status === 'FAIL') statusBadge = `<span class="badge badge-danger">FAIL</span>`;
            else statusBadge = `<span class="badge badge-warning">ENROLLED</span>`;

            tbody.innerHTML += `
                <tr>
                    <td><code>${enr.student_id}</code></td>
                    <td><strong>${enr.first_name} ${enr.last_name}</strong></td>
                    <td><code>${enr.course_code}</code></td>
                    <td>${enr.course_title}</td>
                    <td>${enr.enrollment_date}</td>
                    <td><strong class="text-indigo">${enr.grade || '-'}</strong></td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-icon text-danger" onclick="UI.deleteEnrollment('${enr.student_id}', '${enr.course_code}')" title="Drop Student Course">
                            <i class="fa-solid fa-user-minus"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    },

    deleteEnrollment(studentId, courseCode) {
        if (confirm(`Drop student ${studentId} from ${courseCode}?`)) {
            try {
                alasql('DELETE FROM Enrollment WHERE student_id = ? AND course_code = ?', [studentId, courseCode]);
                DB.saveToStorage();
                this.renderAll();
                this.showToast("Course Dropped", `Student ${studentId} dropped from ${courseCode}.`, "info");
            } catch (e) {
                this.showToast("Error", e.message, "danger");
            }
        }
    },

    renderCoursesAndClasses() {
        const cTbody = document.querySelector('#courses-table tbody');
        if (cTbody) {
            const courses = alasql('SELECT * FROM Course');
            cTbody.innerHTML = '';
            courses.forEach(c => {
                const prereqs = alasql('SELECT pre_req FROM Pre_Requisite_Course WHERE course_code = ?', [c.course_code])
                    .map(r => `<code>${r.pre_req}</code>`).join(', ') || '<span class="text-muted">None</span>';
                
                cTbody.innerHTML += `
                    <tr>
                        <td><code>${c.course_code}</code></td>
                        <td><strong>${c.course_title}</strong></td>
                        <td>${c.credit_hours} Cr.</td>
                        <td>${prereqs}</td>
                    </tr>
                `;
            });
        }

        const clTbody = document.querySelector('#classes-table tbody');
        if (clTbody) {
            const classes = alasql(`
                SELECT CL.*, I.first_name, I.last_name, R.capacity
                FROM Lecture_Class CL
                JOIN Instructor I ON CL.instructor_id = I.instructor_id
                JOIN Room R ON CL.room_no = R.roomno
            `);
            clTbody.innerHTML = '';
            if (classes.length === 0) {
                clTbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center">No classes scheduled.</td></tr>`;
                return;
            }
            classes.forEach(cl => {
                clTbody.innerHTML += `
                    <tr>
                        <td>Dr. ${cl.first_name} ${cl.last_name}</td>
                        <td><code>${cl.course_code}</code></td>
                        <td><span class="badge badge-indigo">Room ${cl.room_no}</span></td>
                        <td>Max ${cl.capacity} seats</td>
                    </tr>
                `;
            });
        }
    },

    renderStaffAndRooms() {
        // Instructors list
        const insContainer = document.getElementById('instructors-list-container');
        if (insContainer) {
            const instructors = alasql('SELECT * FROM Instructor');
            insContainer.innerHTML = '';
            instructors.forEach(ins => {
                const count = alasql.fn.GetClassCountForTeacher(ins.instructor_id);
                insContainer.innerHTML += `
                    <div class="staff-card">
                        <div class="staff-card-left">
                            <h4>Dr. ${ins.first_name} ${ins.last_name}</h4>
                            <p class="text-sm text-muted">${ins.email} | ${ins.phone}</p>
                        </div>
                        <span class="badge badge-indigo">${count} Classes</span>
                    </div>
                `;
            });
        }

        // Departments
        const deptsContainer = document.getElementById('depts-list-container');
        if (deptsContainer) {
            const depts = alasql(`
                SELECT D.*, I.first_name, I.last_name
                FROM Department D
                JOIN Instructor I ON D.hod = I.instructor_id
            `);
            deptsContainer.innerHTML = '';
            depts.forEach(d => {
                deptsContainer.innerHTML += `
                    <div class="staff-card">
                        <div class="staff-card-left">
                            <h4>${d.deptname}</h4>
                            <p class="text-sm text-muted">HOD: Dr. ${d.first_name} ${d.last_name}</p>
                        </div>
                        <span class="badge badge-teal">Code: ${d.deptno}</span>
                    </div>
                `;
            });
        }

        // Rooms
        const rTbody = document.querySelector('#rooms-table tbody');
        if (rTbody) {
            const rooms = alasql('SELECT * FROM Room');
            rTbody.innerHTML = '';
            rooms.forEach(r => {
                rTbody.innerHTML += `
                    <tr>
                        <td><strong>Room ${r.roomno}</strong></td>
                        <td>${r.capacity} seats</td>
                    </tr>
                `;
            });
        }
    },

    populateFormsDropdowns() {
        // Form: Add Student Depts
        const stdDept = document.getElementById('std-dept');
        const studentFilterDept = document.getElementById('student-filter-dept');
        const depts = alasql('SELECT * FROM Department');

        if (stdDept) {
            stdDept.innerHTML = '';
            depts.forEach(d => {
                stdDept.innerHTML += `<option value="${d.deptno}">${d.deptname}</option>`;
            });
        }
        if (studentFilterDept) {
            studentFilterDept.innerHTML = '<option value="ALL">All Departments</option>';
            depts.forEach(d => {
                studentFilterDept.innerHTML += `<option value="${d.deptno}">${d.deptname}</option>`;
            });
        }

        // Form: Enroll Student select
        const enrollStudent = document.getElementById('enroll-student-select');
        const procStudentSelect = document.getElementById('procedure-student-select');
        const students = alasql('SELECT student_id, first_name, last_name FROM Student');

        if (enrollStudent) {
            enrollStudent.innerHTML = '<option value="">-- Choose Student --</option>';
            students.forEach(s => {
                enrollStudent.innerHTML += `<option value="${s.student_id}">${s.student_id} - ${s.first_name} ${s.last_name}</option>`;
            });
        }

        if (procStudentSelect) {
            procStudentSelect.innerHTML = '';
            students.forEach(s => {
                procStudentSelect.innerHTML += `<option value="${s.student_id}">${s.student_id} - ${s.first_name} ${s.last_name}</option>`;
            });
        }

        // Form: Enroll Course select
        const enrollCourse = document.getElementById('enroll-course-select');
        const courses = alasql('SELECT course_code, course_title FROM Course');

        if (enrollCourse) {
            enrollCourse.innerHTML = '<option value="">-- Choose Course --</option>';
            courses.forEach(c => {
                enrollCourse.innerHTML += `<option value="${c.course_code}">${c.course_code} - ${c.course_title}</option>`;
            });
        }
    },

    populateModalDropdowns() {
        const fypAdv = document.getElementById('std-fyp-advisor');
        const thesisAdv = document.getElementById('std-thesis-advisor');
        const instructors = alasql('SELECT instructor_id, first_name, last_name FROM Instructor');

        if (fypAdv && thesisAdv) {
            fypAdv.innerHTML = '<option value="">-- Choose Instructor --</option>';
            thesisAdv.innerHTML = '<option value="">-- Choose Instructor --</option>';
            instructors.forEach(ins => {
                const opt = `<option value="${ins.instructor_id}">Dr. ${ins.first_name} ${ins.last_name}</option>`;
                fypAdv.innerHTML += opt;
                thesisAdv.innerHTML += opt;
            });
        }
    },

    renderViewTab(viewName) {
        const thead = document.getElementById('views-thead-row');
        const tbody = document.getElementById('views-tbody');
        const viewTitle = document.getElementById('view-title');
        const viewSql = document.getElementById('view-sql-definition');

        const sqlDefs = {
            student_details: {
                title: "View 1: student_details",
                sql: `CREATE OR REPLACE VIEW student_details AS
SELECT
    S.STUDENT_ID,
    S.FIRST_NAME || ' ' || S.LAST_NAME AS FULL_NAME,
    S.CNIC,
    S.GENDER,
    S.DOB,
    S.ADDRESS,
    S.PHONE,
    D.DEPTNAME AS DEPARTMENT_NAME,
    H.FIRST_NAME || ' ' || H.LAST_NAME AS DEPARTMENT_HEAD
FROM Student S
LEFT JOIN Department D ON S.DEPTNO = D.DEPTNO 
LEFT JOIN Instructor H ON D.HOD = H.INSTRUCTOR_ID;`
            },
            Enrollment_Details: {
                title: "View 2: Enrollment_Details",
                sql: `CREATE VIEW Enrollment_Details AS
SELECT
    e.STUDENT_ID,
    s.FIRST_NAME,
    s.LAST_NAME,
    e.COURSE_CODE,
    c.COURSE_TITLE,
    e.ENROLLMENT_DATE,
    e.GRADE,
    e.STATUS
FROM Enrollment e
JOIN Student s ON e.STUDENT_ID = s.STUDENT_ID 
JOIN Course c ON e.COURSE_CODE = c.COURSE_CODE;`
            },
            Graduate_Student_Details: {
                title: "View 3: Graduate_Student_Details",
                sql: `CREATE OR REPLACE VIEW Graduate_Student_Details AS
SELECT 
    gs.STUDENT_ID,
    CONCAT(s.FIRST_NAME,CONCAT(' ',s.LAST_NAME)) "STUDENT NAME", 
    s.CNIC,
    s.GENDER,
    s.DOB,
    s.ADDRESS,
    s.PHONE,
    CONCAT(i.FIRST_NAME,CONCAT(' ',i.LAST_NAME)) "ADVISOR NAME", 
    gs.THESIS_STATUS
FROM Graduate_Student gs
JOIN Student s ON gs.STUDENT_ID = s.STUDENT_ID
JOIN Instructor i ON gs.THESIS_ADVISOR = i.INSTRUCTOR_ID;`
            },
            Pre_Requisite_Course_Details: {
                title: "View 4: Pre_Requisite_Course_Details",
                sql: `CREATE OR REPLACE VIEW Pre_Requisite_Course_Details AS
SELECT
    c.COURSE_TITLE AS COURSE_TITLE, 
    prc2.COURSE_TITLE AS PRE_REQ_TITLE
FROM Pre_Requisite_Course prc
JOIN Course c ON prc.COURSE_CODE = c.COURSE_CODE
JOIN Course prc2 ON prc.PRE_REQ = prc2.COURSE_CODE;`
            }
        };

        viewTitle.textContent = sqlDefs[viewName].title;
        viewSql.textContent = sqlDefs[viewName].sql;

        // Fetch view details from AlaSQL View
        try {
            // Ensure active database context
            alasql('USE school_db');
            const data = alasql(`SELECT * FROM ${viewName}`);
            
            thead.innerHTML = '';
            tbody.innerHTML = '';

            if (!data || data.length === 0) {
                thead.innerHTML = `<th>No Columns</th>`;
                tbody.innerHTML = `<tr><td class="text-center text-muted">View returned empty dataset.</td></tr>`;
                return;
            }

            const columns = Object.keys(data[0]);
            columns.forEach(col => {
                thead.innerHTML += `<th>${col.toUpperCase().replace('_', ' ')}</th>`;
            });

            data.forEach(row => {
                let cellHtml = '';
                columns.forEach(col => {
                    cellHtml += `<td>${row[col] === null || row[col] === undefined ? '-' : row[col]}</td>`;
                });
                tbody.innerHTML += `<tr>${cellHtml}</tr>`;
            });
        } catch (e) {
            console.error("View render failed:", e);
            thead.innerHTML = `<th>Error</th>`;
            tbody.innerHTML = `<tr><td class="text-danger">Failed to query view data from database instance. Code error: ${e.message}</td></tr>`;
        }
    },

    runReport(reportNum) {
        const container = document.getElementById('report-output-container');
        const title = document.getElementById('running-report-title');
        const sqlDisplay = document.getElementById('running-report-sql');
        const thead = document.querySelector('#reports-data-table thead tr');
        const tbody = document.querySelector('#reports-data-table tbody');

        container.classList.remove('d-none');

        const reports = {
            "1": {
                title: "Report 1: Graduate Students with Thesis Completed",
                sql: `SELECT 
    S.FIRST_NAME || ' ' || S.LAST_NAME AS NAME, 
    I.FIRST_NAME || ' ' || I.LAST_NAME AS ADVISOR, 
    G.THESIS_STATUS
FROM STUDENT S
JOIN GRADUATE_STUDENT G ON G.STUDENT_ID = S.STUDENT_ID
JOIN INSTRUCTOR I ON I.INSTRUCTOR_ID = G.THESIS_ADVISOR
WHERE G.THESIS_STATUS = 'COMPLETE';`,
                // SQLite variant query for client engine
                query: `SELECT 
                    (S.first_name + ' ' + S.last_name) AS NAME, 
                    (I.first_name + ' ' + I.last_name) AS ADVISOR, 
                    G.thesis_status AS THESIS_STATUS
                FROM Student S
                JOIN Graduate_Student G ON G.student_id = S.student_id
                JOIN Instructor I ON I.instructor_id = G.thesis_advisor
                WHERE G.thesis_status = 'COMPLETE'`
            },
            "2": {
                title: "Report 2: Vacant/Free Classrooms",
                sql: `SELECT R.ROOMNO, R.CAPACITY
FROM ROOM R
LEFT JOIN CLASS C ON R.ROOMNO = C.ROOM_NO
WHERE C.ROOM_NO IS NULL;`,
                query: `SELECT R.roomno AS ROOMNO, R.capacity AS CAPACITY
                FROM Room R
                LEFT JOIN Lecture_Class C ON R.roomno = C.room_no
                WHERE C.room_no IS NULL`
            },
            "3": {
                title: "Report 3: Department Enrollment Statistics with HOD",
                sql: `SELECT
    d.DEPTNO,
    d.DEPTNAME,
    i.FIRST_NAME || ' ' || i.LAST_NAME AS HEAD_NAME,
    COUNT(s.STUDENT_ID) AS STUDENT_COUNT
FROM Department d
JOIN Instructor i ON d.HOD = i.INSTRUCTOR_ID
LEFT JOIN Student s ON d.DEPTNO = s.DEPTNO
GROUP BY d.DEPTNO, d.DEPTNAME, i.FIRST_NAME, i.LAST_NAME;`,
                query: `SELECT
                    d.deptno AS DEPTNO,
                    d.deptname AS DEPTNAME,
                    (i.first_name + ' ' + i.last_name) AS HEAD_NAME,
                    COUNT(s.student_id) AS STUDENT_COUNT
                FROM Department d
                JOIN Instructor i ON d.hod = i.instructor_id
                LEFT JOIN Student s ON d.deptno = s.deptno
                GROUP BY d.deptno, d.deptname, i.first_name, i.last_name`
            },
            "4": {
                title: "Report 4: FYP Advisor Instructors Supervising Students",
                sql: `SELECT DISTINCT 
    I.INSTRUCTOR_ID, 
    I.FIRST_NAME || ' ' || I.LAST_NAME AS NAME
FROM Instructor I
JOIN Undergraduate_Student U ON I.INSTRUCTOR_ID = U.FYP_ADVISOR;`,
                query: `SELECT DISTINCT 
                    I.instructor_id AS INSTRUCTOR_ID, 
                    (I.first_name + ' ' + I.last_name) AS NAME
                FROM Instructor I
                JOIN Undergraduate_Student U ON I.instructor_id = U.fyp_advisor`
            },
            "5": {
                title: "Report 5: Students Failed in Any Subject",
                sql: `SELECT
    S.STUDENT_ID,
    S.FIRST_NAME || ' ' || S.LAST_NAME AS NAME,
    C.COURSE_TITLE,
    I.FIRST_NAME || ' ' || I.LAST_NAME AS TEACHER_NAME
FROM STUDENT S
JOIN ENROLLMENT E ON S.STUDENT_ID = E.STUDENT_ID
JOIN COURSE C ON C.COURSE_CODE = E.COURSE_CODE
JOIN CLASS CL ON E.COURSE_CODE = CL.COURSE_CODE
JOIN INSTRUCTOR I ON I.INSTRUCTOR_ID = CL.INSTRUCTOR_ID
WHERE E.GRADE = 'F';`,
                query: `SELECT
                    S.student_id AS STUDENT_ID,
                    (S.first_name + ' ' + S.last_name) AS NAME,
                    C.course_title AS COURSE_TITLE,
                    (I.first_name + ' ' + I.last_name) AS TEACHER_NAME
                FROM Student S
                JOIN Enrollment E ON S.student_id = E.student_id
                JOIN Course C ON C.course_code = E.course_code
                JOIN Lecture_Class CL ON E.course_code = CL.course_code
                JOIN Instructor I ON I.instructor_id = CL.instructor_id
                WHERE E.grade = 'F'`
            }
        };

        const r = reports[reportNum];
        title.textContent = r.title;
        sqlDisplay.textContent = r.sql;

        try {
            // Ensure active database context
            alasql('USE school_db');
            const data = alasql(r.query);
            thead.innerHTML = '';
            tbody.innerHTML = '';

            if (data.length === 0) {
                thead.innerHTML = `<th>No Rows Found</th>`;
                tbody.innerHTML = `<tr><td class="text-center text-muted">No results found matching this report criteria.</td></tr>`;
                return;
            }

            const cols = Object.keys(data[0]);
            cols.forEach(c => {
                thead.innerHTML += `<th>${c}</th>`;
            });

            data.forEach(row => {
                let cellHtml = '';
                cols.forEach(c => {
                    cellHtml += `<td>${row[c] === null || row[c] === undefined ? '-' : row[c]}</td>`;
                });
                tbody.innerHTML += `<tr>${cellHtml}</tr>`;
            });
        } catch (e) {
            console.error("Report execution error:", e);
            thead.innerHTML = `<th>Execution Error</th>`;
            tbody.innerHTML = `<tr><td class="text-danger">${e.message}</td></tr>`;
        }
    },

    executeConsoleSQL() {
        const queryText = document.getElementById('sql-console-input').value.trim();
        const outputContainer = document.getElementById('console-output-container');
        const errorContainer = document.getElementById('console-error-container');
        const thead = document.getElementById('console-thead-row');
        const tbody = document.querySelector('#console-data-table tbody');
        const queryTime = document.getElementById('console-query-time');

        outputContainer.classList.add('d-none');
        errorContainer.classList.add('d-none');

        if (!queryText) return;

        const start = performance.now();
        try {
            // Ensure active database context
            alasql('USE school_db');
            
            // Run SQL query via AlaSQL
            const data = alasql(queryText);
            const timeTaken = (performance.now() - start).toFixed(1);

            // Check if update/delete/insert statements were executed
            if (typeof data === 'number' || data === undefined) {
                this.showToast("SQL Executed", "Query executed successfully. Database updated.", "success");
                queryTime.textContent = `Completed in ${timeTaken} ms. Affected rows: ${data || 0}`;
                outputContainer.classList.remove('d-none');
                thead.innerHTML = `<th>Status</th>`;
                tbody.innerHTML = `<tr><td>Command successful. Affected rows: ${data || 0}</td></tr>`;
                
                // Save state to localStorage to persist modifications
                DB.saveToStorage();
                this.renderAll();
                return;
            }

            // Normal select queries
            queryTime.textContent = `Returned ${data.length} row(s) in ${timeTaken} ms.`;
            outputContainer.classList.remove('d-none');
            thead.innerHTML = '';
            tbody.innerHTML = '';

            if (data.length === 0) {
                thead.innerHTML = `<th>Empty Dataset</th>`;
                tbody.innerHTML = `<tr><td class="text-muted">Query successfully executed, returned 0 results.</td></tr>`;
                return;
            }

            const cols = Object.keys(data[0]);
            cols.forEach(c => {
                thead.innerHTML += `<th>${c}</th>`;
            });

            data.forEach(row => {
                let cellHtml = '';
                cols.forEach(c => {
                    cellHtml += `<td>${row[c] === null || row[c] === undefined ? '-' : row[c]}</td>`;
                });
                tbody.innerHTML += `<tr>${cellHtml}</tr>`;
            });

        } catch (err) {
            errorContainer.classList.remove('d-none');
            document.getElementById('console-error-message').textContent = err.message;
            this.showToast("SQL Parsing Error", err.message, "danger");
        }
    },

    executeMySQLConsoleSQL() {
        const queryText = document.getElementById('mysql-console-input').value.trim();
        const outputContainer = document.getElementById('mysql-output-container');
        const errorContainer = document.getElementById('mysql-error-container');
        const thead = document.getElementById('mysql-thead-row');
        const tbody = document.querySelector('#mysql-data-table tbody');
        const queryTime = document.getElementById('mysql-query-time');

        outputContainer.classList.add('d-none');
        errorContainer.classList.add('d-none');

        if (!queryText) return;

        const start = performance.now();
        try {
            // Ensure active database context
            alasql('USE school_db');

            // Enable MySQL dialect compatibility mode in AlaSQL
            alasql('SET mysql = ON');
            
            const data = alasql(queryText);
            const timeTaken = (performance.now() - start).toFixed(1);

            // Re-disable MySQL mode
            alasql('SET mysql = OFF');

            // Handle updates/deletes/inserts
            if (typeof data === 'number' || data === undefined) {
                this.showToast("SQL Executed", "MySQL query executed successfully. Database updated.", "success");
                queryTime.textContent = `Completed in ${timeTaken} ms. Affected rows: ${data || 0}`;
                outputContainer.classList.remove('d-none');
                thead.innerHTML = `<th>Status</th>`;
                tbody.innerHTML = `<tr><td>Command successful. Affected rows: ${data || 0}</td></tr>`;
                
                DB.saveToStorage();
                this.renderAll();
                return;
            }

            // Normal select queries
            queryTime.textContent = `Returned ${data.length} row(s) in ${timeTaken} ms.`;
            outputContainer.classList.remove('d-none');
            thead.innerHTML = '';
            tbody.innerHTML = '';

            if (data.length === 0) {
                thead.innerHTML = `<th>Empty Dataset</th>`;
                tbody.innerHTML = `<tr><td class="text-muted">Query successfully executed, returned 0 results.</td></tr>`;
                return;
            }

            const cols = Object.keys(data[0]);
            cols.forEach(c => {
                thead.innerHTML += `<th>${c}</th>`;
            });

            data.forEach(row => {
                let cellHtml = '';
                cols.forEach(c => {
                    cellHtml += `<td>${row[c] === null || row[c] === undefined ? '-' : row[c]}</td>`;
                });
                tbody.innerHTML += `<tr>${cellHtml}</tr>`;
            });

        } catch (err) {
            alasql('SET mysql = OFF');
            errorContainer.classList.remove('d-none');
            document.getElementById('mysql-error-message').textContent = err.message;
            this.showToast("MySQL Parsing Error", err.message, "danger");
        }
    },

    renderMySQLExportCode() {
        const pre = document.getElementById('mysql-export-code');
        if (!pre) return;
        
        pre.textContent = `-- =======================================================
-- IMSciences School Management System
-- MySQL / MariaDB Compatible Export Script
-- Generated Session 2024 - 2028
-- =======================================================

CREATE DATABASE IF NOT EXISTS imsciences_sms;
USE imsciences_sms;

-- Disable foreign key checks for clean recreations
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Enrollment;
DROP TABLE IF EXISTS Class;
DROP TABLE IF EXISTS Pre_Requisite_Course;
DROP TABLE IF EXISTS Course;
DROP TABLE IF EXISTS Room;
DROP TABLE IF EXISTS Undergraduate_Student;
DROP TABLE IF EXISTS Graduate_Student;
DROP TABLE IF EXISTS Student;
DROP TABLE IF EXISTS Department;
DROP TABLE IF EXISTS Instructor;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Instructor
CREATE TABLE Instructor (
    instructor_id CHAR(10) PRIMARY KEY,
    first_name VARCHAR(20) NOT NULL,
    last_name VARCHAR(20) NOT NULL,
    email VARCHAR(30) UNIQUE,
    phone CHAR(13) NOT NULL UNIQUE
);

-- 2. Department
CREATE TABLE Department (
    deptno INT PRIMARY KEY,
    deptname VARCHAR(50) NOT NULL,
    hod CHAR(10),
    FOREIGN KEY (hod) REFERENCES Instructor(instructor_id) ON DELETE SET NULL
);

-- 3. Student
CREATE TABLE Student (
    student_id CHAR(10) PRIMARY KEY,
    first_name VARCHAR(20) NOT NULL,
    last_name VARCHAR(20) NOT NULL,
    cnic CHAR(13) UNIQUE NOT NULL,
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    dob DATE,
    address VARCHAR(50),
    phone CHAR(13) NOT NULL UNIQUE,
    deptno INT,
    FOREIGN KEY (deptno) REFERENCES Department(deptno) ON DELETE SET NULL
);

-- 4. Graduate Student Subtype
CREATE TABLE Graduate_Student (
    student_id CHAR(10) PRIMARY KEY,
    thesis_advisor CHAR(10),
    thesis_status VARCHAR(20) CHECK (thesis_status IN ('COMPLETE', 'IN PROGRESS')),
    FOREIGN KEY (student_id) REFERENCES Student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (thesis_advisor) REFERENCES Instructor(instructor_id) ON DELETE SET NULL
);

-- 5. Undergraduate Student Subtype
CREATE TABLE Undergraduate_Student (
    student_id CHAR(10) PRIMARY KEY,
    fyp_advisor CHAR(10),
    FOREIGN KEY (student_id) REFERENCES Student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (fyp_advisor) REFERENCES Instructor(instructor_id) ON DELETE SET NULL
);

-- 6. Room
CREATE TABLE Room (
    roomno INT PRIMARY KEY,
    capacity INT CHECK (capacity > 0)
);

-- 7. Course
CREATE TABLE Course (
    course_code VARCHAR(10) PRIMARY KEY,
    course_title VARCHAR(50) NOT NULL,
    credit_hours DECIMAL(2,1) CHECK (credit_hours BETWEEN 0.5 AND 3.0)
);

-- 8. Pre_Requisite_Course
CREATE TABLE Pre_Requisite_Course (
    course_code VARCHAR(10),
    pre_req VARCHAR(10),
    PRIMARY KEY (course_code, pre_req),
    FOREIGN KEY (course_code) REFERENCES Course(course_code) ON DELETE CASCADE,
    FOREIGN KEY (pre_req) REFERENCES Course(course_code) ON DELETE CASCADE
);

-- 9. Class (Lecture_Class)
CREATE TABLE Class (
    instructor_id CHAR(10),
    course_code VARCHAR(10),
    room_no INT,
    PRIMARY KEY (instructor_id, course_code),
    FOREIGN KEY (instructor_id) REFERENCES Instructor(instructor_id) ON DELETE CASCADE,
    FOREIGN KEY (course_code) REFERENCES Course(course_code) ON DELETE CASCADE,
    FOREIGN KEY (room_no) REFERENCES Room(roomno) ON DELETE SET NULL
);

-- 10. Enrollment
CREATE TABLE Enrollment (
    student_id CHAR(10),
    course_code VARCHAR(10),
    enrollment_date DATE,
    grade CHAR(1) CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
    status CHAR(4) CHECK (status IN ('PASS', 'FAIL')),
    PRIMARY KEY (student_id, course_code),
    FOREIGN KEY (student_id) REFERENCES Student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (course_code) REFERENCES Course(course_code) ON DELETE CASCADE
);

-- Insert Default Data
-- Instructors
INSERT INTO Instructor VALUES ('I-00000001', 'Mansoor', 'Khan', 'mansoor.khan@ims.edu', '923331112222');
INSERT INTO Instructor VALUES ('I-00000002', 'Sarah', 'Ahmad', 'sarah.ahmad@ims.edu', '923331112223');
INSERT INTO Instructor VALUES ('I-00000003', 'Asim', 'Shah', 'asim.shah@ims.edu', '923331112224');
INSERT INTO Instructor VALUES ('I-00000004', 'Noreen', 'Bibi', 'noreen.bibi@ims.edu', '923331112225');

-- Departments
INSERT INTO Department VALUES (10, 'Management Sciences', 'I-00000001');
INSERT INTO Department VALUES (20, 'Computer Science', 'I-00000002');
INSERT INTO Department VALUES (30, 'Business Administration', 'I-00000003');

-- Students
INSERT INTO Student VALUES ('S-00000001', 'Ali', 'Khan', '1730123456789', 'M', '2005-04-12', 'Hayatabad, Peshawar', '923330001111', 20);
INSERT INTO Student VALUES ('S-00000002', 'Fatima', 'Bibi', '1730123456788', 'F', '2004-09-22', 'Saddar, Peshawar', '923330002222', 20);
INSERT INTO Student VALUES ('S-00000003', 'Usman', 'Shah', '1730123456787', 'M', '2002-11-05', 'Kabal, Swat', '923330003333', 20);
INSERT INTO Student VALUES ('S-00000004', 'Zara', 'Gul', '1730123456786', 'F', '2001-01-30', 'University Rd, Peshawar', '923330004444', 10);
INSERT INTO Student VALUES ('S-00000005', 'Faisal', 'Amin', '1730123456785', 'M', '2005-08-15', 'Phase 6, Hayatabad', '923330005555', 30);

-- Subtypes
INSERT INTO Graduate_Student VALUES ('S-00000003', 'I-00000001', 'COMPLETE');
INSERT INTO Graduate_Student VALUES ('S-00000004', 'I-00000003', 'IN PROGRESS');
INSERT INTO Undergraduate_Student VALUES ('S-00000001', 'I-00000002');
INSERT INTO Undergraduate_Student VALUES ('S-00000002', 'I-00000002');
INSERT INTO Undergraduate_Student VALUES ('S-00000005', 'I-00000004');

-- Rooms
INSERT INTO Room VALUES (101, 30);
INSERT INTO Room VALUES (102, 25);
INSERT INTO Room VALUES (201, 40);
INSERT INTO Room VALUES (202, 15);

-- Courses
INSERT INTO Course VALUES ('CS-101', 'Introduction to Database', 3.0);
INSERT INTO Course VALUES ('CS-201', 'Advanced Database Systems', 3.0);
INSERT INTO Course VALUES ('CS-301', 'Machine Learning', 3.0);
INSERT INTO Course VALUES ('MS-101', 'Principles of Management', 3.0);

-- Prerequisites
INSERT INTO Pre_Requisite_Course VALUES ('CS-201', 'CS-101');

-- Classes
INSERT INTO Class VALUES ('I-00000002', 'CS-101', 101);
INSERT INTO Class VALUES ('I-00000001', 'CS-201', 201);
INSERT INTO Class VALUES ('I-00000003', 'MS-101', 102);

-- Enrollments
INSERT INTO Enrollment VALUES ('S-00000001', 'CS-101', '2025-09-10', 'B', 'PASS');
INSERT INTO Enrollment VALUES ('S-00000002', 'CS-101', '2025-09-10', 'F', 'FAIL');
INSERT INTO Enrollment VALUES ('S-00000003', 'CS-101', '2025-02-15', 'A', 'PASS');
INSERT INTO Enrollment VALUES ('S-00000003', 'CS-201', '2025-09-10', 'B', 'PASS');
INSERT INTO Enrollment VALUES ('S-00000005', 'MS-101', '2026-03-01', NULL, NULL);

-- Views
CREATE OR REPLACE VIEW student_details AS
SELECT 
    S.student_id,
    CONCAT(S.first_name, ' ', S.last_name) AS full_name,
    S.cnic, S.gender, S.dob, S.address, S.phone,
    D.deptname AS department_name,
    CONCAT(H.first_name, ' ', H.last_name) AS department_head
FROM Student S
LEFT JOIN Department D ON S.deptno = D.deptno
LEFT JOIN Instructor H ON D.hod = H.instructor_id;

CREATE OR REPLACE VIEW Enrollment_Details AS
SELECT
    e.student_id, s.first_name, s.last_name,
    e.course_code, c.course_title,
    e.enrollment_date, e.grade, e.status
FROM Enrollment e
JOIN Student s ON e.student_id = s.student_id
JOIN Course c ON e.course_code = c.course_code;

-- Triggers
DELIMITER //
CREATE TRIGGER trg_CheckCourseEnrollmentLimit
BEFORE INSERT ON Enrollment
FOR EACH ROW
BEGIN
    DECLARE v_enrolled_students INT;
    SELECT COUNT(*) INTO v_enrolled_students
    FROM Enrollment
    WHERE course_code = NEW.course_code;
    IF v_enrolled_students >= 20 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Enrollment limit exceeded for this course.';
    END IF;
END //
DELIMITER ;

DELIMITER //
CREATE TRIGGER trg_EnforcePrereqCompletion
BEFORE INSERT ON Enrollment
FOR EACH ROW
BEGIN
    DECLARE v_prereq_completed INT;
    DECLARE v_prereq_required INT;
    SELECT COUNT(*) INTO v_prereq_required FROM Pre_Requisite_Course WHERE course_code = NEW.course_code;
    IF v_prereq_required > 0 THEN
        SELECT COUNT(*) INTO v_prereq_completed FROM Enrollment e
        JOIN Pre_Requisite_Course p ON e.course_code = p.pre_req
        WHERE e.student_id = NEW.student_id AND p.course_code = NEW.course_code AND e.status = 'PASS';
        IF v_prereq_completed < v_prereq_required THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Prerequisite courses not completed.';
        END IF;
    END IF;
END //
DELIMITER ;

-- Stored Procedures
DELIMITER //
CREATE PROCEDURE Student_Result(IN p_student_id CHAR(10))
BEGIN
    SELECT e.course_code, c.course_title, e.grade, e.status
    FROM Enrollment e
    JOIN Course c ON e.course_code = c.course_code
    WHERE e.student_id = p_student_id;
END //
DELIMITER ;`;
    },

    showGenericAddModal(entity) {
        const modal = document.getElementById('generic-modal');
        const title = document.getElementById('generic-modal-title');
        const body = document.getElementById('generic-modal-body');
        const form = document.getElementById('generic-modal-form');

        modal.classList.add('active');

        // Render appropriate form fields based on entity
        if (entity === 'course') {
            title.innerHTML = `<i class="fa-solid fa-plus"></i> Add New Course`;
            body.innerHTML = `
                <input type="hidden" name="entity-type" value="course">
                <div class="form-group">
                    <label>Course Code (CHAR 10)*</label>
                    <input type="text" name="course_code" class="form-control" placeholder="e.g. CS-401" required>
                </div>
                <div class="form-group">
                    <label>Course Title*</label>
                    <input type="text" name="course_title" class="form-control" placeholder="e.g. Artificial Intelligence" required>
                </div>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>Credit Hours*</label>
                        <input type="number" name="credit_hours" step="0.5" min="0.5" max="3" class="form-control" value="3.0" required>
                    </div>
                    <div class="form-group flex-1">
                        <label>Prerequisite (Optional)</label>
                        <select name="pre_req" class="form-control">
                            <option value="">-- None --</option>
                            ${alasql('SELECT course_code, course_title FROM Course').map(c => `
                                <option value="${c.course_code}">${c.course_code} - ${c.course_title}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            `;
        } else if (entity === 'class') {
            title.innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Schedule Lecture Class`;
            body.innerHTML = `
                <input type="hidden" name="entity-type" value="class">
                <div class="form-group">
                    <label>Course*</label>
                    <select name="course_code" class="form-control" required>
                        <option value="">-- Select Course --</option>
                        ${alasql('SELECT course_code, course_title FROM Course').map(c => `
                            <option value="${c.course_code}">${c.course_code} - ${c.course_title}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Instructor*</label>
                    <select name="instructor_id" class="form-control" required>
                        <option value="">-- Select Instructor --</option>
                        ${alasql('SELECT instructor_id, first_name, last_name FROM Instructor').map(i => `
                            <option value="${i.instructor_id}">Dr. ${i.first_name} ${i.last_name}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Lecture Room*</label>
                    <select name="room_no" class="form-control" required>
                        <option value="">-- Select Classroom --</option>
                        ${alasql('SELECT roomno, capacity FROM Room').map(r => `
                            <option value="${r.roomno}">Room ${r.roomno} (Capacity: ${r.capacity})</option>
                        `).join('')}
                    </select>
                </div>
            `;
        } else if (entity === 'instructor') {
            title.innerHTML = `<i class="fa-solid fa-user-tie"></i> Add Instructor Record`;
            body.innerHTML = `
                <input type="hidden" name="entity-type" value="instructor">
                <div class="form-group">
                    <label>Instructor ID (CHAR 10)*</label>
                    <input type="text" name="instructor_id" class="form-control" placeholder="e.g. I-00000005" required>
                </div>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>First Name*</label>
                        <input type="text" name="first_name" class="form-control" required>
                    </div>
                    <div class="form-group flex-1">
                        <label>Last Name*</label>
                        <input type="text" name="last_name" class="form-control" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Email Address*</label>
                    <input type="email" name="email" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Phone Number (CHAR 13)*</label>
                    <input type="text" name="phone" class="form-control" placeholder="e.g. 923331112229" required>
                </div>
            `;
        } else if (entity === 'dept') {
            title.innerHTML = `<i class="fa-solid fa-building"></i> Add Department`;
            body.innerHTML = `
                <input type="hidden" name="entity-type" value="dept">
                <div class="form-group">
                    <label>Dept Code (NUMBER)*</label>
                    <input type="number" name="deptno" class="form-control" placeholder="e.g. 40" required>
                </div>
                <div class="form-group">
                    <label>Department Name*</label>
                    <input type="text" name="deptname" class="form-control" placeholder="e.g. Economics" required>
                </div>
                <div class="form-group">
                    <label>Head of Department (HOD)*</label>
                    <select name="hod" class="form-control" required>
                        <option value="">-- Choose Instructor --</option>
                        ${alasql('SELECT instructor_id, first_name, last_name FROM Instructor').map(i => `
                            <option value="${i.instructor_id}">Dr. ${i.first_name} ${i.last_name}</option>
                        `).join('')}
                    </select>
                </div>
            `;
        } else if (entity === 'room') {
            title.innerHTML = `<i class="fa-solid fa-door-open"></i> Add Lecture Room`;
            body.innerHTML = `
                <input type="hidden" name="entity-type" value="room">
                <div class="form-group">
                    <label>Room Number (NUMBER)*</label>
                    <input type="number" name="roomno" class="form-control" placeholder="e.g. 303" required>
                </div>
                <div class="form-group">
                    <label>Capacity*</label>
                    <input type="number" name="capacity" class="form-control" placeholder="e.g. 40" min="1" required>
                </div>
            `;
        }

        // Form Submission Logic in Generic Modal
        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const type = formData.get('entity-type');

            try {
                if (type === 'course') {
                    const code = formData.get('course_code').trim();
                    const titleStr = formData.get('course_title').trim();
                    const creds = parseFloat(formData.get('credit_hours'));
                    const prereq = formData.get('pre_req');

                    // Check PK
                    if (alasql('SELECT 1 FROM Course WHERE course_code = ?', [code]).length > 0) {
                        throw new Error(`Course Code ${code} already exists.`);
                    }

                    alasql('INSERT INTO Course VALUES (?, ?, ?)', [code, titleStr, creds]);
                    if (prereq) {
                        alasql('INSERT INTO Pre_Requisite_Course VALUES (?, ?)', [code, prereq]);
                    }
                    this.showToast("Course Added", `Course ${code} successfully registered.`, "success");
                } 
                else if (type === 'class') {
                    const inst = formData.get('instructor_id');
                    const cCode = formData.get('course_code');
                    const room = parseInt(formData.get('room_no'));

                    // Unique Class mapping (inst + course_code)
                    if (alasql('SELECT 1 FROM Lecture_Class WHERE instructor_id = ? AND course_code = ?', [inst, cCode]).length > 0) {
                        throw new Error(`Class already scheduled for this instructor and course combination.`);
                    }

                    alasql('INSERT INTO Lecture_Class VALUES (?, ?, ?)', [inst, cCode, room]);
                    this.showToast("Class Scheduled", "Lecture room class mapping saved.", "success");
                }
                else if (type === 'instructor') {
                    const id = formData.get('instructor_id').trim();
                    const fName = formData.get('first_name').trim();
                    const lName = formData.get('last_name').trim();
                    const email = formData.get('email').trim();
                    const phone = formData.get('phone').trim();

                    if (alasql('SELECT 1 FROM Instructor WHERE instructor_id = ?', [id]).length > 0) {
                        throw new Error(`Instructor ID ${id} already exists.`);
                    }
                    if (alasql('SELECT 1 FROM Instructor WHERE email = ?', [email]).length > 0) {
                        throw new Error(`Email ${email} is already registered.`);
                    }
                    if (alasql('SELECT 1 FROM Instructor WHERE phone = ?', [phone]).length > 0) {
                        throw new Error(`Phone number ${phone} is already registered.`);
                    }

                    alasql('INSERT INTO Instructor VALUES (?, ?, ?, ?, ?)', [id, fName, lName, email, phone]);
                    this.showToast("Instructor Saved", `Record for Dr. ${lName} created.`, "success");
                }
                else if (type === 'dept') {
                    const no = parseInt(formData.get('deptno'));
                    const name = formData.get('deptname').trim();
                    const hod = formData.get('hod');

                    if (alasql('SELECT 1 FROM Department WHERE deptno = ?', [no]).length > 0) {
                        throw new Error(`Department Code ${no} already exists.`);
                    }

                    alasql('INSERT INTO Department VALUES (?, ?, ?)', [no, name, hod]);
                    this.showToast("Department Created", `${name} added to departments list.`, "success");
                }
                else if (type === 'room') {
                    const no = parseInt(formData.get('roomno'));
                    const cap = parseInt(formData.get('capacity'));

                    if (alasql('SELECT 1 FROM Room WHERE roomno = ?', [no]).length > 0) {
                        throw new Error(`Room number ${no} already exists.`);
                    }
                    if (cap <= 0) {
                        throw new Error("Capacity must be a positive integer.");
                    }

                    alasql('INSERT INTO Room VALUES (?, ?)', [no, cap]);
                    this.showToast("Room Registered", `Room ${no} with capacity ${cap} registered.`, "success");
                }

                DB.saveToStorage();
                modal.classList.remove('active');
                this.renderAll();
            } catch (err) {
                this.showToast("Database Validation Failed", err.message, "danger");
            }
        };
    },

    showToast(title, msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        else if (type === 'danger') icon = 'fa-triangle-exclamation';
        else if (type === 'warning') icon = 'fa-circle-exclamation';

        toast.innerHTML = `
            <i class="fa-solid ${icon} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${msg}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Click to close
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        // Auto destroy
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
};

// Start application
window.onload = () => {
    UI.init();
};
