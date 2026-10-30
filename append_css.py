import os

file_path = r'c:\Users\User\Desktop\mock_website\quiz\static\quiz\style.css'
css_to_append = """
/* --- VIBRANT GREEN SELECTION --- */
.choice-label.selected {
    background: linear-gradient(135deg, var(--accent), #059669) !important;
    border-color: var(--accent) !important;
    color: var(--white) !important;
    box-shadow: 0 4px 15px var(--accent-glow) !important;
    transform: scale(1.02);
}

.choice-label.selected .choice-text {
    font-weight: 700 !important;
}

.choice-label.selected .choice-radio {
    border-color: var(--white) !important;
    background: var(--white) !important;
}

.choice-label.selected .choice-radio::after {
    background: var(--accent) !important;
    transform: scale(1) !important;
}

/* Review Highlights */
.choice-label.user-selected {
    background: linear-gradient(135deg, var(--accent), #059669) !important;
    border-color: var(--accent) !important;
    color: var(--white) !important;
    box-shadow: 0 4px 15px var(--accent-glow) !important;
}
"""

with open(file_path, 'a') as f:
    f.write(css_to_append)

print("Successfully appended CSS")
