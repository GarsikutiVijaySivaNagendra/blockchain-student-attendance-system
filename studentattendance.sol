// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StudentAttendance {

    address public owner;

    uint256 public studentCount;

    struct Student {
        uint256 id;
        string name;
        uint256 registerNumber;
        bool exists;
    }

    mapping(uint256 => Student) public students;

    // Date number => Student ID => Attendance status
    mapping(uint256 => mapping(uint256 => bool)) public attendance;
    mapping(uint256 => mapping(uint256 => bool)) public attendanceMarked;

    // Student ID => attendance dates and corresponding status
    mapping(uint256 => uint256[]) private studentDates;
    mapping(uint256 => bool[]) private studentStatuses;

    event StudentAdded(
        uint256 studentId,
        string name,
        uint256 registerNumber
    );

    event AttendanceRecorded(
        uint256 studentId,
        uint256 dateNumber,
        bool isPresent
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Add a new student
    function addStudent(
        string memory _name,
        uint256 _registerNumber
    ) public onlyOwner {

        require(bytes(_name).length > 0, "Student name required");

        studentCount++;

        students[studentCount] = Student({
            id: studentCount,
            name: _name,
            registerNumber: _registerNumber,
            exists: true
        });

        emit StudentAdded(
            studentCount,
            _name,
            _registerNumber
        );
    }

    // Mark one student present
    function markAttendance(
        uint256 _studentId
    ) public onlyOwner {

        _markAttendance(_studentId, true);
    }

    // Mark one student absent
    function markAbsent(
        uint256 _studentId
    ) public onlyOwner {

        _markAttendance(_studentId, false);
    }

    // Mark all students in ONE transaction
    function markBulkAttendance(
        uint256[] memory studentIds,
        bool[] memory presentStatus
    ) public onlyOwner {

        require(
            studentIds.length == presentStatus.length,
            "Array length mismatch"
        );

        require(
            studentIds.length > 0,
            "No students provided"
        );

        for (uint256 i = 0; i < studentIds.length; i++) {

            _markAttendance(
                studentIds[i],
                presentStatus[i]
            );
        }
    }

    // Internal attendance function
    function _markAttendance(
        uint256 _studentId,
        bool _isPresent
    ) internal {

        require(
            students[_studentId].exists,
            "Student does not exist"
        );

        // Current UTC day number
        uint256 today = block.timestamp / 86400;

        require(
            !attendanceMarked[today][_studentId],
            "Attendance already marked for this student today"
        );

        attendanceMarked[today][_studentId] = true;

        attendance[today][_studentId] = _isPresent;

        studentDates[_studentId].push(today);

        studentStatuses[_studentId].push(_isPresent);

        emit AttendanceRecorded(
            _studentId,
            today,
            _isPresent
        );
    }

    // Get student details
    function getStudent(
        uint256 _studentId
    )
        public
        view
        returns (
            uint256,
            string memory,
            uint256,
            bool
        )
    {
        Student memory s = students[_studentId];

        require(s.exists, "Student not found");

        return (
            s.id,
            s.name,
            s.registerNumber,
            s.exists
        );
    }

    // Get attendance history of one student
    function getAttendanceHistory(
        uint256 _studentId
    )
        public
        view
        returns (
            uint256[] memory,
            bool[] memory
        )
    {
        return (
            studentDates[_studentId],
            studentStatuses[_studentId]
        );
    }

    // Get attendance for a particular date and student
    function getAttendance(
        uint256 _dateNumber,
        uint256 _studentId
    ) public view returns (bool) {

        return attendance[_dateNumber][_studentId];
    }

    // Get all student IDs for a date
    function getStudentsByDate(
        uint256 _dateNumber
    ) public view returns (uint256[] memory) {

        uint256 count = 0;

        for (uint256 i = 1; i <= studentCount; i++) {
            if (attendanceMarked[_dateNumber][i]) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);

        uint256 index = 0;

        for (uint256 i = 1; i <= studentCount; i++) {
            if (attendanceMarked[_dateNumber][i]) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }

    // Get attendance percentage of one student
    // Returns: total marked days, present days, percentage
    function getAttendancePercentage(
        uint256 _studentId
    )
        public
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        require(
            students[_studentId].exists,
            "Student not found"
        );

        uint256 totalDays = studentDates[_studentId].length;
        uint256 presentDays = 0;

        for (uint256 i = 0; i < totalDays; i++) {
            if (studentStatuses[_studentId][i]) {
                presentDays++;
            }
        }

        uint256 percentage = 0;

        if (totalDays > 0) {
            percentage = (presentDays * 100) / totalDays;
        }

        return (
            totalDays,
            presentDays,
            percentage
        );
    }
}