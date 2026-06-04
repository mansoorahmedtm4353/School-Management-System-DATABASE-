# IMSciences School Management System Database Application

This project is a high-fidelity, self-contained, browser-based database application for the **School Management System** designed for IMSciences. 

It implements a client-side SQL database engine (**AlaSQL**) that replicates the exact relational schema, constraints, views, stored procedures, and triggers defined in the semester project report. All data modifications are fully persistent using the browser's `localStorage`.

---

## 🌟 Key Features

1. **Relational Database Schema**: 10 interconnected tables representing Students, Graduate/Undergraduate subtypes, Instructors, Departments, Rooms, Course catalog, Prerequisites, Classes, and Enrollments.
2. **Persistent SQL Engine (AlaSQL)**: Runs real SQL queries directly in the browser! Data persists across page reloads.
3. **Database Views**: 4 dynamic views matching the report specifications:
   - `student_details`
   - `Enrollment_Details`
   - `Graduate_Student_Details`
   - `Pre_Requisite_Course_Details`
4. **Stored Procedures & Functions**:
   - `Student_Result`: Simulates student transcript generation and outputs Oracle/PostgreSQL notice logs in an interactive console window.
   - `InsertStudent`: Handles registrations and maps subtype specifics.
   - `InsertGrade`: Takes course marks and auto-calculates letter grades (A, B, C, D, F) and status (PASS/FAIL).
   - `GetAVGGradePoint`, `GetClassCountForTeacher`, `GetTotalGraduateStudentsInDept` user-defined SQL functions.
5. **Database Triggers**:
   - `trg_CheckCourseEnrollmentLimit`: Throws a database error if enrollments exceed 20 students for a course.
   - `trg_EnforcePrereqCompletion`: Prevents enrollment in courses unless prerequisite courses have been completed and passed.
6. **SQL Console Terminal**: Write and execute raw custom SQL queries (e.g. `SELECT`, `UPDATE`, joins, aggregations) against the database and view output tables.
7. **5 Common Reports**: Interactive rendering of the 5 institutional reports:
   - Students with complete thesis
   - Unscheduled/vacant classrooms
   - Department student count and HOD details
   - Unique undergraduate FYP supervisor list
   - Registry of students failing any subject

---

## 🚀 How to Run the Project

1. **Locate the Project Directory**:
   Go to: `C:\Users\HP\.gemini\antigravity\scratch\school-management-system`
2. **Open the Application**:
   Double-click the **[index.html](file:///C:/Users/HP/.gemini/antigravity/scratch/school-management-system/index.html)** file, or right-click and choose **"Open with Google Chrome"** (or your preferred web browser).
   No installation, servers, or environment setup is required!
3. **Set Active Workspace (Recommended)**:
   Please set this folder (`C:\Users\HP\.gemini\antigravity\scratch\school-management-system`) as your active workspace in your editor configuration.

---

## 🔬 Scenario Testing & Verification Guide

Follow these steps to verify that the database constraints, procedures, and triggers are fully operational in the user interface:

### 1. Test Prerequisite Completion Trigger (`trg_EnforcePrereqCompletion`)
* In the database, **Advanced Database Systems (CS-201)** has a prerequisite: **Introduction to Database (CS-101)**.
* Try to enroll student **Fatima Bibi (S-00000002)** in **CS-201** with or without marks.
* **Expected Result**: A red database trigger error toast will appear: *"Trigger trg_EnforcePrereqCompletion: Prerequisite course not completed. Student must first complete and PASS 'CS-101 (Introduction to Database)'."*
* Fatima has a grade of **'F' (FAIL)** in CS-101, which is why the trigger blocks the transaction!

### 2. Bypass Prerequisite Verification
* Select **S-00000002 (Fatima)**, course **CS-101 (Intro to Database)**, and input marks **80** (to change her failing grade to a pass).
* Click **Submit Enrollment** to update her grade. (A toast will confirm the grade is computed as **'B' / 'PASS'**).
* Now, try to enroll **Fatima** in **CS-201** again.
* **Expected Result**: The enrollment succeeds! The prerequisite constraint is satisfied.

### 3. Test Student Result Stored Procedure (`Student_Result`)
* Go to the **Dashboard** tab.
* In the **Student Result Lookup** panel, select **S-00000003 (Usman Shah)** and click **Generate Transcript**.
* **Expected Result**: The console output box simulates standard PL/pgSQL DBMS notice buffers, outputting:
  ```text
  DBMS_OUTPUT: Beginning execution for Student ID: S-00000003
  DBMS_OUTPUT: ----------------------------------------------------
  DBMS_OUTPUT: Course Code:  CS-101
  DBMS_OUTPUT: Course Title: Introduction to Database
  DBMS_OUTPUT: Grade:        A
  DBMS_OUTPUT: Status:       PASS
  DBMS_OUTPUT: ---------------------------------------------
  DBMS_OUTPUT: Course Code:  CS-201
  ...
  DBMS_OUTPUT: Procedure completed successfully.
  ```

### 4. Custom SQL Terminal
* Go to the **SQL Console** tab.
* Click **Load Sample Query** or type:
  `SELECT * FROM Student_Details WHERE gender = 'M';`
* Click **Execute Query**.
* **Expected Result**: The console prints the execution speed and renders a beautiful, structured table of matching records.
