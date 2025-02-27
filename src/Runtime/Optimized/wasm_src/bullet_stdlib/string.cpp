#include <string>

static size_t strlen(const char* str) {
    const char* s;
    for (s = str; *s; ++s);
    return (s - str);
}

static void strcpy(char* dest, const char* src) {
    while (*src) {
        *dest = *src;
        dest += 1;
        src += 1;
    }
    *dest = '\0';
}

std::string::string() : m_length(0), m_str(nullptr) {}
        
std::string::string(const char* str) :
    m_length(strlen(str)),
    m_str(static_cast<char*>(malloc(m_length + 1))) {
    strcpy(const_cast<char*>(m_str), str);
}

std::string::~string() { // destructor
    free(static_cast<void*>(const_cast<char*>(m_str)));
}

std::string::string(const std::string& other) : // copy constructor
    m_length(other.m_length),
    m_str(static_cast<char*>(malloc(m_length + 1))) {
    strcpy(const_cast<char*>(m_str), other.m_str);
}

std::string::string(std::string&& other) { // move constructor
    char* tmp_str = m_str;
    m_str = other.m_str;
    other.m_str = tmp_str;

    size_t tmp_length = m_length;
    m_length = other.m_length;
    other.m_length = tmp_length;
}

std::string& std::string::operator=(const std::string& other) { // copy assignment
    if (this != &other) {
        free(static_cast<void*>(const_cast<char*>(m_str)));
        m_length = other.m_length;
        m_str = static_cast<char*>(malloc(m_length + 1));
        strcpy(const_cast<char*>(m_str), other.m_str);
    }
    return *this;
}

std::string& std::string::operator=(std::string&& other) { // move assignment
    if (this != &other) {
        char* tmp_str = m_str;
        m_str = other.m_str;
        other.m_str = tmp_str;

        size_t tmp_length = m_length;
        m_length = other.m_length;
        other.m_length = tmp_length;
    }
    return *this;
}

bool std::string::operator==(const string& other) const {
    if (m_length != other.m_length) {
        return false;
    }
    bool equal = true;
    for (size_t i = 0; i < m_length; ++i) {
        if (m_str[i] != other.m_str[i]) {
            equal = false;
            break;
        }
    }
    return equal;
}

const char* std::string::c_str() const {
    return m_str;
}
