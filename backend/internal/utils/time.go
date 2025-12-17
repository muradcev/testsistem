package utils

import "time"

// Turkey timezone (UTC+3)
var TurkeyLocation *time.Location

func init() {
	var err error
	TurkeyLocation, err = time.LoadLocation("Europe/Istanbul")
	if err != nil {
		// Fallback: UTC+3
		TurkeyLocation = time.FixedZone("TRT", 3*60*60)
	}
}

// NowTurkey returns current time in Turkey timezone
func NowTurkey() time.Time {
	return time.Now().In(TurkeyLocation)
}

// ToTurkey converts a time to Turkey timezone
func ToTurkey(t time.Time) time.Time {
	return t.In(TurkeyLocation)
}

// FormatTurkey formats a time in Turkey timezone
func FormatTurkey(t time.Time, layout string) string {
	return t.In(TurkeyLocation).Format(layout)
}
