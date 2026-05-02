import socket
import json
import numpy as np
import math
import time
import csv

HOST = "0.0.0.0"   # Lytt på alle nettverkskort
PORT = 4444
L=50
NODE_POS = {
    1: np.array([0.0, 0.0]),
    2: np.array([L,   0.0]),
    3: np.array([L/2, (math.sqrt(3)/2)*L]),
}

# RSSI-modell (juster etter kalibrering)
nodes_calibrate = [-60.0 , -63.0, -60.0]  # RSSI ved 1 meter
n = 2.0  # Path loss exponent
latest_rssi= {
    "unit0":{},
    "unit1":{},
    "unit2":{},
    "unit3":{},
}
last_seen = {}
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((HOST, PORT))

pathPos="frontend/API/dataPos.json"
pathHits="frontend/API/dataHits.json"

print(f"Lytter på UDP port {PORT} ...\n")

def rssi_to_distance(rssi, node_A):
    return 10 ** ((node_A - rssi) / (10 * n))

def trilaterate(num):
    if len(latest_rssi["unit"+num]) < 3:
        return None

    nodes = list(NODE_POS.keys())[:3]
    p1, p2, p3 = [NODE_POS[n] for n in nodes]
    d1, d2, d3 = [rssi_to_distance(latest_rssi["unit"+num][n], nodes_calibrate[n-1] ) for n in nodes]

    # Linearisert trilaterasjon
    A_mat = np.array([
        2*(p2 - p1),
        2*(p3 - p1)
    ])

    b = np.array([
        d1**2 - d2**2 + np.dot(p2, p2) - np.dot(p1, p1),
        d1**2 - d3**2 + np.dot(p3, p3) - np.dot(p1, p1)
    ])
    
    try:
        xy = np.linalg.lstsq(A_mat, b, rcond=None)[0]
        return xy
    except:
        return None


last_print = 0

data_hits = {
    "node1":0,
    "node2":0,
    "node3":0
}
with open(pathHits, 'w') as f:
    json.dump(data_hits,f,indent=4)

while True:
    data, addr = sock.recvfrom(1024)
    message = data.decode("utf-8", errors="ignore")

    try:
        parsed = json.loads(message)
        print(message)
        node = parsed["node"]
        rssi = parsed["rssi"]
        unit = parsed["unit"]

        latest_rssi["unit"+str(unit)][node] = rssi
        last_seen[node] = time.time()
        data_hits["node"+str(node)]+=1
        with open(pathHits,"w") as f:
            json.dump(data_hits,f,indent=4)


    except:
        continue

    # print koordinater ca 5 Hz
    if time.time() - last_print > 0.2:
        last_print = time.time()

        xy = trilaterate(str(unit))
        if xy is not None:
            x, y = xy
            row = [x, y]
            rowcount = 0
            if x>3 or x<-1 or y>3 or y< -1:
                pass
            else:
                # Read existing data
                try:
                    with open(pathPos, 'r') as f:
                        data_pack = json.load(f)
                except (FileNotFoundError, json.JSONDecodeError):
                    data_pack = {}
                
                # Add/update current unit's position
                data_pack[f"unit{unit}"] = {"x": round(x, 2), "y": round(y, 2)}
                
                # Write updated data
                with open(pathPos, 'w') as f:
                    json.dump(data_pack, f, indent=4)
            latest_rssi[f"unit{unit}"] = {}
        else:
            print("Venter på 3 noder...")