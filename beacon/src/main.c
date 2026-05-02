/* main.c - Application main entry point */

/*
 * Copyright (c) 2015-2016 Intel Corporation
 *
 * SPDX-License-Identifier: Apache-2.0
 */

#include <zephyr/types.h>
#include <stddef.h>
#include <zephyr/sys/printk.h>
#include <zephyr/sys/util.h>

#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/hci.h>
#include <zephyr/bluetooth/gap.h>

#define DEVICE_NAME CONFIG_BT_DEVICE_NAME
#define DEVICE_NAME_LEN (sizeof(DEVICE_NAME) - 1)

/*
 * 128-bit UUID som skal annonseres:
 * c0de1234-0000-4000-8000-000000000001
 *
 * NB: Advertising-data bruker little-endian byte-rekkefølge.
 */
static const uint8_t svc_uuid[16] = {
	0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80,
	0x00, 0x40, 0x00, 0x00, 0x34, 0x12, 0xde, 0xc0
};

/* Set Advertisement data */
static const struct bt_data ad[] = {
	/* Flags: LE only (ingen BR/EDR) */
	BT_DATA_BYTES(BT_DATA_FLAGS, (BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR)),

	/* Complete list of 128-bit Service UUIDs */
	BT_DATA(BT_DATA_UUID128_ALL, svc_uuid, sizeof(svc_uuid)),
};
/*static const struct bt_le_adv_param adv_param =
    BT_LE_ADV_PARAM(BT_LE_ADV_OPT_USE_IDENTITY,
                    BT_GAP_MS_TO_ADV_INTERVAL(500),
                    BT_GAP_MS_TO_ADV_INTERVAL(700),
                    NULL);*/
/* Scan response data (kan være tom for passiv scanning)
 * Hvis du vil ha navn i scan response, kan du aktivere dette igjen.
 */
// static const struct bt_data sd[] = {
// 	BT_DATA(BT_DATA_NAME_COMPLETE, DEVICE_NAME, DEVICE_NAME_LEN),
// };

static void bt_ready(int err)
{
	char addr_s[BT_ADDR_LE_STR_LEN];
	bt_addr_le_t addr = {0};
	size_t count = 1;

	if (err) {
		printk("Bluetooth init failed (err %d)\n", err);
		return;
	}

	printk("Bluetooth initialized\n");

	struct bt_le_adv_param adv_param = {
		.options = BT_LE_ADV_OPT_USE_IDENTITY,
		.interval_min = 800,   // 500 ms
		.interval_max = 1120,  // 700 ms
		.peer = NULL
	};
	/* Start advertising (non-connectable). Ingen scan response. */
	err = bt_le_adv_start( &adv_param, //BT_LE_ADV_NCONN_IDENTITY
			      ad, ARRAY_SIZE(ad),
			      NULL, 0);
	if (err) {
		printk("Advertising failed to start (err %d)\n", err);
		return;
	}

	bt_id_get(&addr, &count);
	bt_addr_le_to_str(&addr, addr_s, sizeof(addr_s));

	printk("Beacon started, advertising as %s\n", addr_s);
}

int main(void)
{
	k_sleep(K_MSEC(100));
	int err;

	printk("Starting Beacon Demo (UUID128)\n");

	/* Initialize the Bluetooth Subsystem */
	err = bt_enable(bt_ready);
	if (err) {
		printk("Bluetooth init failed (err %d)\n", err);
	}

	return 0;
}
