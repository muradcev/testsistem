package api

import (
	"encoding/json"
	"net/http"
	"os"
	"sync"

	"github.com/gin-gonic/gin"
)

type Province struct {
	Name      string     `json:"name"`
	Districts []District `json:"districts"`
}

type District struct {
	Name          string   `json:"name"`
	Neighborhoods []string `json:"neighborhoods"`
}

type LocationData struct {
	Provinces []Province `json:"provinces"`
}

var (
	locationData *LocationData
	loadOnce     sync.Once
)

func loadLocationData() {
	loadOnce.Do(func() {
		data, err := os.ReadFile("../data/turkey_locations.json")
		if err != nil {
			// Try alternative path
			data, err = os.ReadFile("data/turkey_locations.json")
			if err != nil {
				return
			}
		}

		locationData = &LocationData{}
		json.Unmarshal(data, locationData)
	})
}

func GetProvinces(c *gin.Context) {
	loadLocationData()

	if locationData == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konum verileri yüklenemedi"})
		return
	}

	provinces := make([]string, len(locationData.Provinces))
	for i, p := range locationData.Provinces {
		provinces[i] = p.Name
	}

	c.JSON(http.StatusOK, gin.H{"provinces": provinces})
}

func GetDistricts(c *gin.Context) {
	loadLocationData()

	if locationData == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konum verileri yüklenemedi"})
		return
	}

	provinceName := c.Param("province")

	for _, p := range locationData.Provinces {
		if p.Name == provinceName {
			districts := make([]string, len(p.Districts))
			for i, d := range p.Districts {
				districts[i] = d.Name
			}
			c.JSON(http.StatusOK, gin.H{"districts": districts})
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "İl bulunamadı"})
}

func GetNeighborhoods(c *gin.Context) {
	loadLocationData()

	if locationData == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Konum verileri yüklenemedi"})
		return
	}

	provinceName := c.Param("province")
	districtName := c.Param("district")

	for _, p := range locationData.Provinces {
		if p.Name == provinceName {
			for _, d := range p.Districts {
				if d.Name == districtName {
					c.JSON(http.StatusOK, gin.H{"neighborhoods": d.Neighborhoods})
					return
				}
			}
			c.JSON(http.StatusNotFound, gin.H{"error": "İlçe bulunamadı"})
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "İl bulunamadı"})
}
