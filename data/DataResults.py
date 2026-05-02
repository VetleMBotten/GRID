import csv
import numpy as np
path='csvStatsentrum.csv'

x_values = []
y_values = []

with open(path, 'r') as file:
    reader = csv.reader(file)
    for row in reader:
        x_values.append(float(row[0]))
        y_values.append(float(row[1]))

x_expected = np.average(x_values)
y_expected = np.average(y_values)


#ddof = 1 fordi Tjelmeland anbefaler det
x_std = np.std(x_values, ddof=1)
y_std = np.std(y_values, ddof=1)

print(f"Forventningsverdi for X: {x_expected} Forventningsverdi for Y: {y_expected}")
print(f"Standardavvik for X: {x_std} Standardavvik for Y: {y_std}")