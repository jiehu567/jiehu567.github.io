---
layout: post
title:  "Open Street Map Data Wrangling with MongoDB"
categories: jekyll update
img: OpenStreetMap.png
---


Clean the open street data of [San Francisco Bay Area](https://mapzen.com/data/metro-extracts/metro/san-francisco-bay_california/) and write into MongoDB database, after which yields some visualization work.

The structure of this report is:

1. Problems in dataset
2. Data Cleaning
3. Discusion on improvements I made
4. Data Overview and Wrangling with MongoDB
5. Additional Ideas
6. Conclusion


### Part 1. Problems in dataset


```{.python .input  n=1}
# import package
# Load packages and raw data file
import re
from collections import defaultdict
import json
import xml.etree.cElementTree as ET
import pprint
import numpy as np
import datetime as dt

osm_file = 'sf_sample.osm'
```

After I get sample data, I find out there are several problems in the dataset.

1. data are listed within different tags, which might have different structure: 

```{.python .input  n=2}
# type and number of nodes
dic = defaultdict(int)

for _, elem in ET.iterparse(osm_file):
    dic[elem.tag] +=1
print dic
```

<div class='outputs' n=2>
defaultdict(<type 'int'>, {'node': 47149, 'nd': 56388, 'member': 370, 'tag': 17356, 'relation': 56, 'way': 5512, 'osm': 1})

</div>

2. keys, like 'exit_to', 'exit_to:left', 'exit_to:right' can be involved in one list
3. keys, like 'lat' and 'lon' can be saved in a dictionary to seperate from other attributes:
~~~~
{
    'position': {'lat': ..., 
                 'lon': ...
                 }
}
~~~~
4. value of 'timestamp' is just a string, which can be transformed into: 
~~~~
{
    'time': {'year':...,
             'month':...,
             'day':...,
             ...}
}
~~~~
5. keys, like 'sfgov.org', 'addr.source' can not be used in MongoDB because they include '.'
6. keys, like 'addr:country', 'addr:state' should be transformed into:

~~~~
{
    'addr': {'city': ...
             'country':...
             'state':...
 ...
}
~~~~
instead of:
~~~~
{
    'addr:city':...
    'addr:country':...
    'addr:state':...
}
~~~~


### Part 2. Data Cleaning

Then I check data structure of each node, and write a function to process each part respectively.

**Problems 1-4:**

The method 'attach_node' will process node according to its type and problems and then save into a dictionary, 'temp_dic'. Then after this, the processed data of such node, in the form of dictionary will be appended to a list.

```{.python .input  n=3}
def attach_node(temp_dic, node_name):
    for node in elem.iter(node_name):
            # add uid, version, changeset, user, id
            for key in ['uid', 'version', 'changeset', 'user', 'id']:    
                if node.attrib.has_key(key):
                    temp_dic[key] = node.attrib[key]

            # add position with latitude and longitude
            if node.attrib.has_key('lat') and node.attrib.has_key('lon'):
                temp_dic['position'] = {'lat': float(node.attrib['lat']),
                                        'lon': float(node.attrib['lon'])}

            # timestamp into year, month, day, hour, minute, second
            if node.attrib.has_key('timestamp'):
                time = dt.datetime.strptime(node.attrib['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
                temp_dic['time'] = {'year': time.year,
                                    'month': time.month,
                                    'day': time.day,
                                    'hour': time.hour,
                                    'minute': time.minute}         # Here I think not necessary to extract second


            # attach data from key 'tag'
            for tag in node.iter('tag'):

                # attach tag value IN exit_to list
                exit_arr = []
                for key in ['exit_to','exit_to:left','exit_to:right']:
                    if tag.attrib['k'] == key:
                        exit_arr.append(tag.attrib['v'])

                if exit_arr != []:
                    temp_dic['exit_to'] = exit_arr

                # attach tag value NOT IN exit_to list
                if not tag.attrib['k'] in ['exit_to','exit_to:left','exit_to:right']:
                    temp_dic[tag.attrib['k']] = tag.attrib['v']

            temp_dic['node_type'] = node_name
```

```{.python .input  n=4}
# Process data

dic_sample = []

for _, elem in ET.iterparse(osm_file):

    temp_dic = {}
    
    
    # attach data from key 'member'
    for member in elem.iter('member'):
        for key in member.keys():
            if member.attrib[key] != "":
                temp_dic[key] = member.attrib[key]
            else:
                temp_dic[key] = None
    
    # attach data from key 'node'
    attach_node(temp_dic, 'node')
    
    # attach data from key 'relation', it's exactly the same as 'node'
    attach_node(temp_dic, 'relation')
    
    # attach data from key 'way', it's exactly the same as 'node'
    attach_node(temp_dic, 'way')
    
    if temp_dic != {}:
        dic_sample.append(temp_dic)
        
```

Now dic_sample almost have cleaned data:

```{.python .input  n=5}
dic_sample[:2]
```

<div class='outputs' n=5>

</div>

** Problem 5**
- keys, like 'sfgov.org', 'addr.source' can not be used in MongoDB because they include '.'
- keys, like 'addr:country', 'addr:state' should be transformed into:

~~~~
{
    'addr': {'city': ...
             'country':...
             'state':...
 ...
}
~~~~

Then will be solved by below replacement, my idea is not just process address data, but also all data structured in such way, now I need to check what these key like:

```{.python .input  n=6}
post_style = re.compile(r'.*:.*')
key_set = set()
for item in dic_sample:
    for key, value in item.items():
        if post_style.match(key) and key not in key_set:
            key_set.add(key)

# print key_set
```

Result of print:
~~~~
{'FG:COND_INDEX', 
 'FG:GPS_DATE',
 ...
 'Tiger:HYDROID',
 'Tiger:MTFCC',
 'abandoned:place',
 ...
 'addr:city',
 ..
 }
~~~~

Here's the method to do the processing:

```{.python .input  n=7}
# change key:sub_key pairs into key: {subkey1:..., subkey2:...,...}

re_style = re.compile(r'.+:.+')

for item in dic_sample:
    
    key_set = set()
    
    for item_key in item.keys():
        if re_style.match(item_key):
            item_subkeys = item_key.split(':')
            if len(item_subkeys) >= 2:
                if item_subkeys[0] not in key_set:
                    key_set.add(item_subkeys[0])
                    item[item_subkeys[0]] = {}
            
                item[item_subkeys[0]][item_subkeys[1]] = item.pop(item_key)
                    
            

```

** Problem 6**

Some keys, for example: {'addr.source', 'sfgov.org'} is not suitable to be used in MongoDB so I replace them.

```{.python .input  n=8}
post_style = re.compile(r'.+\..+')
for item in dic_sample:
    for key, value in item.items():
        if key == 'addr.source':
            if item.has_key('addr'):
                item['addr']['source'] = item.pop('addr.source')
            else:
                item['addr_source'] = item.pop('addr.source')
        elif key == 'sfgov.org':
            item['sfgov'] = item.pop('sfgov.org')

```

Now dic_sample saved our data in a pretty good format, so I can store it into a JSON file.

```{.python .input  n=9}
import json
with open('data_example.json', 'w') as fp:
    json.dump(dic_sample, fp)
```

#### Part 3: Discussion on improvements I made

There are 6 improvements made to the original dataset, but they might have risk. In this section I gonna discuss the pros and cons of these improvements one by one.

* Improve 1 to: data are listed within different tags, which might have different structure

  * Pros:
    * it's very clear and fast to do the improvements by add them directly into a list of dictionary based on the key I already know.
    * adding key 'node_type' can both keep uniform structure for each node and keep information of its node type for future usage


  * Cons:
    * I use same method based on the assumption that the nodes, like 'node', 'way', 'member' and 'relation' have similar structure of keys and corresponding values. It's possible some typo or unintended error or, eventually, some designed difference might occur within each node. 
  
  * Suggestion for future:
    * In future, if to explore further, a script to exam structure of each node is necessary.


* Improve 2 to: keys, like 'exit_to', 'exit_to:left', 'exit_to:right' can be involved in one list


  * Pros:
    * After merge these keys into one list, it's pretty clear to know all exit of node/way values
    
  * Cons:
    * It's hard to tell if it's going straightforward or to left or to right
    
  * Suggesition for future:
    * Better create a dictionary with structure:
    
    ~~~~
    {
        'exit_to': {'type': 'left', 'value': '...'}
    }
    ~~~~
    


* Improve 3 to: keys, like 'lat' and 'lon' can be saved in a dictionary to seperate from other attributes:
~~~~
{
    'position': {'lat': ..., 
                 'lon': ...
                 }
}
~~~~

  * Pros:
    It makes data logically structured and meanwhile keep all information. Accessing the data of position is also very easy.

  * Cons:
    I don't see any cons for this improvements.


* Improve 4 to: value of 'timestamp' is just a string, which can be transformed into: 
~~~~
{
    'time': {'year':...,
             'month':...,
             'day':...,
             ...}
}
~~~~

  * Pros:
    It makes data logically structured and meanwhile keep all information of time. 
    
  * Cons:
    It might take 5 or more times of storage to store the data because the original data is just a string, but now it is seperated into 5 values: year, month, day, hour, minute.
    
  * Suggestions for future


* Improve 5 to: keys, like 'sfgov.org', 'addr.source' can not be used in MongoDB because they include '.'

  * Pros:
    It prohibits potential error by adding keys like 'addr.source' directly to MongoDB because '.' means subkey of key or zooming in key of a document in MongoDB.
    
  * Cons:
    I don't see if there's any con. It's a must step before we write data into database.
    

* Improve 6 to: keys, like 'addr:country', 'addr:state' should be transformed into:

~~~~
{
    'addr': {'city': ...
             'country':...
             'state':...
 ...
}
~~~~
instead of:
~~~~
{
    'addr:city':...
    'addr:country':...
    'addr:state':...
}
~~~~

  * Pros:
    It makes data logically structured and meanwhile keep all information of address. 
    
  * Cons:
    It might take much more times of storage to store the data because the original data is just a string, but now it is seperated into several different values.
  
  * Future suggestion:
    Be careful about the size of database before write in data.
  

Beside the pros and cons discussed above, it's possible to have other unseen problems. Any ideas are welcome to email me: [jie.hu.ds@gmail.com](mailto: jie.hu.ds@gmail.com)

### Part 4. Data Overview and Wrangling with MongoDB


Now start my MongoDB, connect with python client, and insert the data:


```{.python .input  n=10}
from pymongo import MongoClient
```

```{.python .input  n=11}
client = MongoClient('localhost:27017')
db = client.openstreetmap

for item in dic_sample:
    db.openstreetmap.insert_one(item)
    
```

Basic data information:

sf_sample.osm ..................... 102.5 MB
san-francisco_california.osm........1.01  GB    

(Because it takes too long time to process whole data on my old mac, here I will only use sample data, which is large enough for this project. Ideas will be the same)

data_example.json .... 132.1 MB
                                                
#### Number of documents

```{.python .input  n=14}
db.openstreetmap.find().count()
```

<div class='outputs' n=14>

</div>

#### Number of nodes

```{.python .input  n=15}
db.openstreetmap.find({"node_type":"node"}).count()
```

<div class='outputs' n=15>

</div>

#### Number of way

```{.python .input  n=16}
db.openstreetmap.find({"node_type":"way"}).count()
```

<div class='outputs' n=16>

</div>

All are exactly match what we get in front of this report:

{'node': 471488, ..., 'way': 55115})

Number of 'way' is almost same, I will just ignore the only one difference of count.

#### Number of unique users

```{.python .input  n=17}
len(db.openstreetmap.distinct('user'))
```

<div class='outputs' n=17>

</div>

Here I use below methods to write my query pipelines:

```{.python .input  n=18}
def aggregate(db, pipeline):
    return [doc for doc in db.openstreetmap.aggregate(pipeline)]
```

```{.python .input  n=19}
def make_pipeline():
    pipeline = [{"$group": {"_id": "$user",
                                        "count": {"$sum": 1}}},
                            {"$sort": {"count": -1}},
                            {"$limit": 10}
]
    return pipeline
```

#### Top 10 most contribution users

```{.python .input  n=20}
import pprint
pipeline = make_pipeline()
result = aggregate(db, pipeline)
pprint.pprint(result)
```

<div class='outputs' n=20>
[{u'_id': u'ediyes', u'count': 101137},
 {u'_id': u'Luis36995', u'count': 78167},
 {u'_id': u'Rub21', u'count': 43527},
 {u'_id': u'RichRico', u'count': 24717},
 {u'_id': u'calfarome', u'count': 20438},
 {u'_id': u'oldtopos', u'count': 18451},
 {u'_id': u'KindredCoda', u'count': 16608},
 {u'_id': u'karitotp', u'count': 14981},
 {u'_id': u'samely', u'count': 13886},
 {u'_id': u'abel801', u'count': 11921}]

</div>

### Part 5: Additional Ideas

#### Most contribution hour

```{.python .input  n=21}
def make_pipeline():
    pipeline = [{"$group": {"_id": "$time.hour",
                                        "count": {"$sum": 1}}},
                            {"$sort": {"count": -1}},
                            {"$limit": 24}
]
    return pipeline

pipeline = make_pipeline()
result = aggregate(db, pipeline)
result_dic = {}
for item in result:
    result_dic[item['_id']] = item['count']
```

```{.python .input  n=23}
import matplotlib.pyplot as plt

values = result_dic.values()
clrs = ['#01cab4' if (x < max(values)) else '#ff3f49' for x in values ]

plt.bar(range(len(result_dic)), values, align='center', color = clrs)
plt.title("Most Contribution Hour")
plt.xlabel("Hour")
plt.ylabel("Contribution")
plt.xlim(-1,24)
plt.show()
```

<div class='outputs' n=23>

<div class="figure output">
![](data:image/png;base64,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)
</div>

</div>

#### most contribution month

```{.python .input  n=24}
def make_pipeline():
    pipeline = [{"$group": {"_id": "$time.month",
                                        "count": {"$sum": 1}}},
                            {"$sort": {"count": -1}},
                            {"$limit": 24}
]
    return pipeline

pipeline = make_pipeline()
result = aggregate(db, pipeline)
result_dic = {}
for item in result:
    result_dic[item['_id']] = item['count']

values = result_dic.values()
clrs = ['#01cab4' if (x < max(values)) else '#ff3f49' for x in values ]

plt.bar(range(len(result_dic)), values, align='center', color = clrs)
plt.title("Most Contribution Month")
plt.xlabel("Month")
plt.ylabel("Contribution")
plt.xlim(-1,13)
plt.show()
```

<div class='outputs' n=24>

<div class="figure output">
![](data:image/png;base64,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)
</div>

</div>

#### Top 10 appearing amenities

```{.python .input  n=25}
def make_pipeline():
    pipeline = [{"$match":{"amenity":{"$exists":1}}},
                {"$group": {"_id": "$amenity",
                                        "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10}
]
    return pipeline


pipeline = make_pipeline()
result = aggregate(db, pipeline)
result
```

<div class='outputs' n=25>

</div>

#### Most popular cuisines

```{.python .input  n=26}
def make_pipeline():
    pipeline = [{"$match":{"amenity":{"$exists":1}}},
                {"$group": {"_id": "$cuisine",
                            "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10}
]
    return pipeline


pipeline = make_pipeline()
result = aggregate(db, pipeline)
result
```

<div class='outputs' n=26>

</div>

While ignoring the None type, we can say that the coffee shops are most popular cuisine.

#### Part 6: Conclusion


This project offers me very effecient way to wrangle data. I've learned extracting, transforming and loading technicals and I found a lot of interesting ideas in the city I'm living. I'm amazed by the data produced by people.

Regarding the possible improvements of this report, I think below approaches might be a good choice:
- Time distribution of top10 contributors
- Most frequent contribution regions, I think bounding boxes of district in San Francisco are required
- Distribution of most popular cuisines, we can see this from how people with different culture background might be distributed

```{.python .input}

```
